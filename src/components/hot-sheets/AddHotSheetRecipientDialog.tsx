import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

interface AddHotSheetRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotSheetId: string;
  agentUserId: string | null;
  /** Client ids already attached as recipients — excluded from the list. */
  existingRecipientClientIds: string[];
  /** Called after a successful add so the parent can refresh recipients. */
  onAdded: () => void | Promise<void>;
}

const displayName = (c: ContactRow) => {
  const full = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  if (full) return full;
  return c.email?.trim() || "Unnamed contact";
};

export function AddHotSheetRecipientDialog({
  open,
  onOpenChange,
  hotSheetId,
  agentUserId,
  existingRecipientClientIds,
  onAdded,
}: AddHotSheetRecipientDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setQuery("");
      return;
    }
    if (!agentUserId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone")
        .eq("agent_id", agentUserId)
        .order("first_name", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[AddHotSheetRecipientDialog] load contacts failed", error);
        toast.error("Could not load your contacts.");
        setContacts([]);
      } else {
        setContacts((data ?? []) as ContactRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, agentUserId]);

  const existingSet = useMemo(
    () => new Set(existingRecipientClientIds),
    [existingRecipientClientIds],
  );

  const eligible = useMemo(
    () => contacts.filter((c) => !existingSet.has(c.id)),
    [contacts, existingSet],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((c) => {
      const name = displayName(c).toLowerCase();
      const email = (c.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [eligible, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0 || !hotSheetId) return;
    setSaving(true);
    const rows = Array.from(selected).map((cid) => ({
      hot_sheet_id: hotSheetId,
      client_id: cid,
    }));
    const { error } = await supabase
      .from("hot_sheet_clients")
      .upsert(rows, { onConflict: "hot_sheet_id,client_id", ignoreDuplicates: true });
    if (error) {
      console.error("[AddHotSheetRecipientDialog] insert failed", error);
      toast.error(error.message ?? "Could not add contacts to the hot sheet.");
      setSaving(false);
      return;
    }
    toast.success(
      selected.size === 1
        ? "Contact added to hot sheet."
        : `${selected.size} contacts added to hot sheet.`,
    );
    setSaving(false);
    onOpenChange(false);
    await onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-neutral-500" aria-hidden />
            Add contact to hot sheet
          </DialogTitle>
          <DialogDescription>
            Pick one or more CRM contacts to attach as recipients. They will be
            included the next time you send this hot sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="h-9 pl-8 text-[13px]"
            />
          </div>

          <div className="max-h-[320px] min-h-[180px] overflow-y-auto rounded-lg border border-neutral-200 bg-white">
            {loading ? (
              <div className="flex h-[180px] items-center justify-center text-[12px] text-neutral-500">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                Loading contacts…
              </div>
            ) : eligible.length === 0 ? (
              <div className="flex h-[180px] flex-col items-center justify-center gap-2 px-6 text-center text-[12px] text-neutral-500">
                <p>All your contacts are already on this hot sheet.</p>
                <Link
                  to="/contacts"
                  className="text-[12px] font-medium text-aac hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  Add a new contact →
                </Link>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-[180px] items-center justify-center px-6 text-center text-[12px] text-neutral-500">
                No contacts match “{query}”.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {filtered.map((c) => {
                  const id = `add-rec-${c.id}`;
                  const isChecked = selected.has(c.id);
                  return (
                    <li key={c.id}>
                      <label
                        htmlFor={id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-neutral-50"
                      >
                        <Checkbox
                          id={id}
                          checked={isChecked}
                          onCheckedChange={() => toggle(c.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-neutral-900">
                            {displayName(c)}
                          </p>
                          {c.email ? (
                            <p className="truncate text-[11px] text-neutral-500">
                              {c.email}
                            </p>
                          ) : null}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={saving || selected.size === 0}
          >
            {saving
              ? "Adding…"
              : selected.size > 0
              ? `Add ${selected.size} to hot sheet`
              : "Add to hot sheet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddHotSheetRecipientDialog;