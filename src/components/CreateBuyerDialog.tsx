import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check, ChevronsUpDown, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatedBuyerPayload {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CreateBuyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (created?: CreatedBuyerPayload) => void;
}

interface AgentContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  client_type: string | null;
}

export function CreateBuyerDialog({ open, onOpenChange, onSuccess }: CreateBuyerDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<AgentContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<AgentContact | null>(null);

  // Load this agent's CRM contacts when the dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setContactsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setContactsLoading(false); return; }
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, client_type")
        .eq("agent_id", user.id)
        .order("first_name", { ascending: true })
        .limit(500);
      if (!cancelled) {
        if (error) console.error("[CreateBuyerDialog] load contacts failed", error);
        setContacts(data ?? []);
        setContactsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setSelectedContact(null);
  };

  const applyContact = (c: AgentContact) => {
    setSelectedContact(c);
    setFirstName(c.first_name ?? "");
    setLastName(c.last_name ?? "");
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setPickerOpen(false);
  };

  const clearSelectedContact = () => {
    setSelectedContact(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
  };

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("First name, last name, and email are required.");
      return;
    }

    setSaving(true);
    try {
      const failWithStep = (step: string, error: any): never => {
        console.error(`[CreateBuyerDialog] ${step} failed`, {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          raw: error,
        });
        throw new Error(error?.message || `${step} failed`);
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in.");
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      // 0. Block if this email already belongs to an AAC account (agent or buyer).
      //    Skip when picking from contacts (the contact may already be in AAC and
      //    we still want to flip them to a buyer for this agent).
      if (!selectedContact) {
        const { data: alreadyRegistered, error: regCheckErr } = await supabase.rpc(
          "is_email_registered_with_aac" as any,
          { p_email: normalizedEmail }
        );
        if (regCheckErr) {
          failWithStep("check existing AAC account", regCheckErr);
        }
        if (alreadyRegistered === true) {
          toast.error(
            "This email is already registered with AAC. They already have an account — share your AAC profile link instead."
          );
          return;
        }
      }

      // 1. Look up an existing CRM contact for this agent + email so we can
      //    reactivate instead of hitting the unique-constraint error. If the
      //    agent picked from the contact list, use that record directly.
      let existing: AgentContact | null = selectedContact;
      if (!existing) {
        const { data: existingRow, error: existingErr } = await supabase
          .from("clients")
          .select("id, first_name, last_name, email, phone, client_type")
          .eq("agent_id", user.id)
          .ilike("email", normalizedEmail)
          .maybeSingle();

        if (existingErr && existingErr.code !== "PGRST116") {
          failWithStep("lookup existing contact", existingErr);
        }
        existing = existingRow ?? null;
      }

      if (existing) {
        // Flip non-buyer contacts to buyer + backfill any missing name fields.
        const updates: Record<string, any> = {};
        if (existing.client_type !== "buyer") updates.client_type = "buyer";
        if (!existing.first_name && firstName.trim()) updates.first_name = firstName.trim();
        if (!existing.last_name && lastName.trim()) updates.last_name = lastName.trim();
        if (!existing.phone && phone.trim()) updates.phone = phone.trim();
        if (!existing.email && normalizedEmail) updates.email = normalizedEmail;
        if (Object.keys(updates).length > 0) {
          const { error: updErr } = await supabase
            .from("clients")
            .update(updates)
            .eq("id", existing.id);
          if (updErr) failWithStep("update existing contact", updErr);
        }

        // Look up the latest relationship for this contact so we can branch.
        const { data: rel } = await supabase
          .from("client_agent_relationships")
          .select("id, status, ended_at, client_id")
          .eq("agent_id", user.id)
          .eq("crm_client_id", existing.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const isActive = rel && !rel.ended_at && rel.status === "active";
        const isPending = rel && !rel.ended_at && rel.status === "pending";

        if (isActive) {
          toast.error("This buyer is already in My Buyers.");
          return;
        }
        if (isPending) {
          toast.error("This buyer already has a pending invite.");
          return;
        }

        if (rel) {
          // Ended / inactive / declined → reactivate prior relationship.
          const { error: reactErr } = await supabase.rpc(
            "agent_reactivate_buyer" as any,
            { p_crm_client_id: existing.id }
          );
          if (reactErr) failWithStep("reactivate existing buyer", reactErr);
        } else {
          // No relationship yet (e.g. existing contact who was never a buyer).
          const { error: relErr } = await supabase
            .from("client_agent_relationships")
            .insert({
              agent_id: user.id,
              client_id: null,
              status: "pending",
              crm_client_id: existing.id,
            } as any);
          if (relErr) failWithStep("insert client_agent_relationships", relErr);
        }

        toast.success(
          selectedContact
            ? "Contact added as a buyer."
            : "Buyer reactivated."
        );
        const reactivatedPayload: CreatedBuyerPayload = {
          id: existing.id,
          firstName: existing.first_name || firstName.trim(),
          lastName: existing.last_name || lastName.trim(),
          email: (existing.email || normalizedEmail).toLowerCase(),
        };
        resetForm();
        onOpenChange(false);
        onSuccess(reactivatedPayload);
        return;
      }

      // 2. No existing contact → original insert path
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({
          agent_id: user.id,
          agent_user_id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: normalizedEmail,
          phone: phone.trim() || null,
          client_type: "buyer",
          source: "manual",
        })
        .select("id")
        .single();

      if (clientErr) {
        failWithStep("insert clients", clientErr);
      }

      // 3. Insert client_agent_relationships
      const { error: relErr } = await supabase
        .from("client_agent_relationships")
        .insert({
          agent_id: user.id,
          client_id: null,
          status: "pending",
          crm_client_id: client.id,
        } as any);

      if (relErr) failWithStep("insert client_agent_relationships", relErr);

      toast.success("Buyer created successfully.");
      const createdPayload: CreatedBuyerPayload = {
        id: client.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      };
      resetForm();
      onOpenChange(false);
      onSuccess(createdPayload);
    } catch (err: any) {
      console.error("Error creating buyer:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        raw: err,
      });
      toast.error(err?.message || "Can't add buyer. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Buyer</DialogTitle>
          <DialogDescription>
            Create a new buyer profile. They will also appear in your Contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Contact picker */}
          <div className="space-y-1.5">
            <Label>Pick from Contacts (optional)</Label>
            {selectedContact ? (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {(selectedContact.first_name || "") + " " + (selectedContact.last_name || "")}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selectedContact.email}
                      {selectedContact.client_type && selectedContact.client_type !== "buyer" && (
                        <span className="ml-2 rounded bg-background border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                          {selectedContact.client_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelectedContact}
                  className="h-7 px-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {contactsLoading ? "Loading contacts…" : "Search existing contacts…"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or email…" />
                    <CommandList>
                      <CommandEmpty>No contacts found.</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((c) => {
                          const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Unnamed";
                          return (
                            <CommandItem
                              key={c.id}
                              value={`${name} ${c.email ?? ""}`}
                              onSelect={() => applyContact(c)}
                            >
                              <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-sm">{name}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {c.email}
                                  {c.client_type && (
                                    <span className="ml-2 uppercase tracking-wide text-[10px]">
                                      · {c.client_type}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            <p className="text-[11px] text-muted-foreground">
              {selectedContact
                ? "This contact will be marked as a buyer."
                : "Or enter a new buyer below — they'll also be saved to your Contacts."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="buyer-first">First Name *</Label>
              <Input
                id="buyer-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                disabled={!!selectedContact}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyer-last">Last Name *</Label>
              <Input
                id="buyer-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                disabled={!!selectedContact}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-email">Email *</Label>
            <Input
              id="buyer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              disabled={!!selectedContact}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-phone">Phone (optional)</Label>
            <FormattedInput
              id="buyer-phone"
              type="tel"
              inputMode="numeric"
              format="phone"
              value={phone}
              onChange={(val) => setPhone(val)}
              placeholder="(555) 555-5555"
              disabled={!!selectedContact && !!selectedContact.phone}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Buyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
