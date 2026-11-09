import { OTHER_MEMBER_EMAIL_MESSAGE } from "@/lib/agentContactResolver";
import { useState, useEffect } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { searchClientContacts } from "@/lib/contactSearch";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { US_STATES } from "@/data/usStatesCountiesData";
import {
  DEFAULT_HOT_SHEET_CRITERIA,
  fromCriteriaPayload,
  toCriteriaPayload,
} from "@/lib/hotSheetCriteriaCore";
import { normalizeTownSelections } from "@/lib/townSelection";
import {
  HotSheetCriteriaBuilder,
  type HotSheetCriteriaFormValue,
} from "@/components/communication-center/HotSheetCriteriaBuilder";

interface EditHotsheetCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotSheetId: string;
  initialCriteria: any;
  onUpdate: () => void;
}

export function EditHotsheetCriteriaDialog({
  open,
  onOpenChange,
  hotSheetId,
  initialCriteria,
  onUpdate,
}: EditHotsheetCriteriaDialogProps) {
  // Criteria form — shared Hot Sheet / Comms filter builder
  const [criteria, setCriteria] = useState<HotSheetCriteriaFormValue>(DEFAULT_HOT_SHEET_CRITERIA);
  const [zipCode, setZipCode] = useState("");
  const [saving, setSaving] = useState(false);

  // Contacts — mirrors CreateHotSheetDialog
  const [selectedClients, setSelectedClients] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
  }>>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Preload criteria when dialog opens
  useEffect(() => {
    if (!open || !initialCriteria) return;
    const c = initialCriteria as Record<string, unknown>;
    const coreCriteria = fromCriteriaPayload(c);

    // Normalize state
    const loadedState = coreCriteria.state as string | undefined;
    const normalizedState = loadedState && loadedState.length > 2
      ? (US_STATES.find(s => s.name === loadedState)?.code ?? loadedState)
      : (loadedState || "MA");

    setCriteria({
      ...coreCriteria,
      state: normalizedState,
      cities: normalizeTownSelections(coreCriteria.cities),
    });
    setZipCode((c.zipCode as string) || "");
  }, [open, initialCriteria]);

  // Resolve the current agent and load the hot sheet's contacts when the dialog opens
  useEffect(() => {
    if (!open || !hotSheetId) return;

    setContactsLoaded(false);
    setShowClientPicker(false);
    setClientSearchQuery("");
    setClientSearchResults([]);
    setShowClientDropdown(false);

    let cancelled = false;

    const loadContacts = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!cancelled) setUserId(authData?.user?.id ?? null);

        // Same junction query used by CreateHotSheetDialog's edit mode
        const { data: hotSheetClients, error } = await supabase
          .from('hot_sheet_clients' as any)
          .select(`
            client_id,
            clients (
              id,
              first_name,
              last_name,
              email,
              phone
            )
          `)
          .eq('hot_sheet_id', hotSheetId);

        if (error) throw error;

        const clients = (hotSheetClients || [])
          .map((hsc: any) => {
            const client = hsc.clients;
            return Array.isArray(client) ? client[0] : client;
          })
          .filter((client: any): client is NonNullable<typeof client> => client != null);

        if (!cancelled) {
          setSelectedClients(clients);
          setContactsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load hot sheet contacts:", error);
        // Fail-safe: leave contacts unloaded so Save never touches the junction
        if (!cancelled) setContactsLoaded(false);
      }
    };

    void loadContacts();
    return () => {
      cancelled = true;
    };
  }, [open, hotSheetId]);

  // Search existing contacts as the agent types — same helper as CreateHotSheetDialog
  useEffect(() => {
    const searchClients = async () => {
      if (!clientSearchQuery || clientSearchQuery.length < 2 || !open || !userId) {
        setClientSearchResults([]);
        setShowClientDropdown(false);
        return;
      }

      try {
        const data = await searchClientContacts({
          agentId: userId,
          query: clientSearchQuery,
          select: "*",
          limit: 10,
        });
        setClientSearchResults(data);
        setShowClientDropdown(data.length > 0);
      } catch (error) {
        console.error("Error searching clients:", error);
        setClientSearchResults([]);
      }
    };

    const timer = setTimeout(searchClients, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery, userId, open]);

  const handleSelectClient = async (client: any) => {
    setShowClientDropdown(false);
    if (selectedClients.some(c => c.id === client.id)) {
      toast.error("This person is already added");
      return;
    }

    // Same guard as CreateHotSheetDialog: block contacts registered with another agent
    const email = (client.email || "").trim();
    if (email) {
      const { data, error } = await supabase.rpc("check_client_has_other_agent", {
        p_client_email: email,
      });
      if (!error && data === true) {
        toast.error(OTHER_MEMBER_EMAIL_MESSAGE);
        return;
      }
    }

    setSelectedClients(prev => [...prev, {
      id: client.id,
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      phone: client.phone,
    }]);

    setClientSearchQuery("");
    setClientSearchResults([]);
    setShowClientDropdown(false);
    setShowClientPicker(false);

    toast.success(`Added contact: ${client.first_name} ${client.last_name}`);
  };

  const handleRemoveClient = (clientId: string) => {
    if (selectedClients.length <= 1) {
      toast.error("A hot sheet needs at least one contact");
      return;
    }
    setSelectedClients(prev => prev.filter(c => c.id !== clientId));
    toast.success("Contact removed");
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const hotsheetCriteria = {
        ...toCriteriaPayload(criteria),
        zipCode: zipCode || null,
      };

      // Preserve the Search first-batch selection (criteria.selectedListingIds);
      // editing matching criteria must never drop the agent's chosen first batch.
      const { data: existingRow } = await supabase
        .from("hot_sheets")
        .select("criteria")
        .eq("id", hotSheetId)
        .maybeSingle();
      const existingSelected = (existingRow?.criteria as any)?.selectedListingIds;
      if (Array.isArray(existingSelected) && existingSelected.length > 0) {
        (hotsheetCriteria as any).selectedListingIds = existingSelected;
      }

      const { error } = await supabase
        .from("hot_sheets")
        .update({ criteria: hotsheetCriteria })
        .eq("id", hotSheetId);

      if (error) throw error;

      // Sync the hot_sheet_clients junction — only when contacts loaded cleanly,
      // so a failed load can never wipe existing links.
      if (contactsLoaded) {
        const { data: existingRows, error: existingError } = await supabase
          .from('hot_sheet_clients' as any)
          .select('client_id')
          .eq('hot_sheet_id', hotSheetId);
        if (existingError) throw existingError;

        const existingIds = new Set((existingRows || []).map((row: any) => row.client_id));
        const selectedIds = new Set(selectedClients.map(c => c.id));

        const toRemove = [...existingIds].filter(id => !selectedIds.has(id));
        const toAdd = [...selectedIds].filter(id => !existingIds.has(id));

        if (toRemove.length > 0) {
          const { error: removeError } = await supabase
            .from('hot_sheet_clients' as any)
            .delete()
            .eq('hot_sheet_id', hotSheetId)
            .in('client_id', toRemove);
          if (removeError) throw removeError;
        }

        if (toAdd.length > 0) {
          const { error: addError } = await supabase
            .from('hot_sheet_clients' as any)
            .insert(toAdd.map(clientId => ({ hot_sheet_id: hotSheetId, client_id: clientId })));
          if (addError) throw addError;
        }
      }

      toast.success("Search criteria updated");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to update criteria:", error);
      toast.error("Failed to update search criteria");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,900px)] w-[calc(100%-1.25rem)] max-w-4xl gap-0 overflow-y-auto border border-neutral-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.07)] sm:w-full sm:max-h-[90vh] sm:rounded-xl sm:p-5 sm:gap-4">
        <DialogHeader className="space-y-2 pb-2 text-left sm:pb-3">
          <DialogTitle className="text-lg font-semibold tracking-tight text-neutral-900">
            Edit search criteria
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-snug text-neutral-500">
            Review contacts and update location, property type, status, and numeric filters. Changes apply when you save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:space-y-6 sm:p-5">
          {/* Contacts — same picker and styling as Create Hot Sheet */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold uppercase">Contacts</Label>
            {!contactsLoaded ? (
              <p className="text-sm text-muted-foreground">Loading contacts…</p>
            ) : selectedClients.length > 0 ? (
              <div className="space-y-2">
                <div className="space-y-2 rounded-md border border-emerald-100 bg-emerald-50/40 p-2">
                  {selectedClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-2.5"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/10"
                          aria-hidden
                        >
                          <Check className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{client.first_name} {client.last_name}</div>
                          <div className="text-xs text-muted-foreground">{client.email}</div>
                          {client.phone && (
                            <div className="text-xs text-muted-foreground">{formatPhoneNumber(client.phone)}</div>
                          )}
                        </div>
                      </div>
                      {selectedClients.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveClient(client.id)}
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {!showClientPicker && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-neutral-200 px-2.5 text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                    onClick={() => setShowClientPicker(true)}
                  >
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Add Additional Contact
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No contacts attached to this hot sheet.</p>
            )}

            {contactsLoaded && showClientPicker && (
              <div className="space-y-2 relative">
                <Label htmlFor="edit-client-search">Search Existing Contact</Label>
                <Input
                  id="edit-client-search"
                  placeholder="Search by name or email..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (clientSearchResults.length > 0) {
                      setShowClientDropdown(true);
                    }
                  }}
                  onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setShowClientDropdown(false);
                        }
                      }}
                      onBlur={() => {
                    setTimeout(() => setShowClientDropdown(false), 200);
                  }}
                />
                {showClientDropdown && clientSearchResults.length > 0 && (
                  <div role="listbox" data-testid="contact-search-results" className="relative mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
                    {clientSearchResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelectClient(client)}
                        className="w-full border-b border-neutral-100 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-neutral-50/90 last:border-b-0"
                      >
                        <div className="font-medium text-sm">{client.first_name} {client.last_name}</div>
                        <div className="text-xs text-muted-foreground">{client.email}</div>
                        {client.phone && (
                          <div className="text-xs text-muted-foreground">{formatPhoneNumber(client.phone)}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowClientPicker(false);
                    setClientSearchQuery("");
                    setClientSearchResults([]);
                    setShowClientDropdown(false);
                  }}
                >
                  Done
                </Button>
              </div>
            )}
          </div>

          <HotSheetCriteriaBuilder
            value={criteria}
            onChange={setCriteria}
            idPrefix="edit-hs"
          />

          <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Label htmlFor="edit-zipcode" className="text-sm font-medium text-neutral-700">
              Zip Code
            </Label>
            <Input
              id="edit-zipcode"
              placeholder="e.g. 02101"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="max-w-[200px] border-neutral-200 bg-white"
            />
          </div>

        </div>

        <div className="mt-1 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:mt-2 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            type="button"
            className="h-9 flex-1 rounded-md border-neutral-200 bg-white text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-neutral-300 hover:bg-neutral-50/90"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 flex-1 rounded-md border border-[#0B46CC]/20 bg-[#0E56F5] text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-neutral-400/55 focus-visible:ring-offset-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
