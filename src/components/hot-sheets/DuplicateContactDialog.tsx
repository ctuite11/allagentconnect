import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Mail, Phone, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAgentContactsCache } from "@/lib/contactSearch";

export type DuplicateExistingClient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

interface DuplicateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingClient: DuplicateExistingClient | null;
  typedName: string;
  /** Called when the agent chooses to attach the existing contact to this hot sheet. */
  onAddToSheet: (client: DuplicateExistingClient) => void | Promise<void>;
  /** Called after the existing contact is removed from THIS agent's CRM. */
  onDeleted: () => void | Promise<void>;
}

const displayName = (c: DuplicateExistingClient) => {
  const full = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  return full || c.email || "Unnamed contact";
};

export function DuplicateContactDialog({
  open,
  onOpenChange,
  existingClient,
  typedName,
  onAddToSheet,
  onDeleted,
}: DuplicateContactDialogProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmingDelete(false);
      setDeleting(false);
      setAdding(false);
    }
  }, [open]);

  if (!existingClient) return null;

  const handleAdd = async () => {
    if (adding || deleting) return;
    setAdding(true);
    try {
      await onAddToSheet(existingClient);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || adding) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("agent_end_client_relationship", {
        p_client_id: existingClient.id,
      });
      if (error) {
        console.error("[DuplicateContactDialog] end relationship failed", error);
        toast.error(error.message ?? "Could not remove this contact.");
        setDeleting(false);
        return;
      }
      // The RPC ends the relationship + nulls client_type but keeps the CRM row.
      // Remove this agent's CRM row so the duplicate-email lookup no longer matches.
      // RLS ("Agents can delete their own clients") scopes this strictly to the caller's
      // own contact row — it does not touch buyer auth or any other agent's CRM data.
      const { error: deleteError } = await supabase
        .from("clients")
        .delete()
        .eq("id", existingClient.id);
      if (deleteError) {
        console.error("[DuplicateContactDialog] delete CRM row failed", deleteError);
        toast.error(deleteError.message ?? "Could not fully remove this contact.");
        setDeleting(false);
        return;
      }
      invalidateAgentContactsCache();
      toast.success("Contact removed from your CRM.");
      await onDeleted();
    } catch (err) {
      console.error("[DuplicateContactDialog] unexpected error", err);
      toast.error("Could not remove this contact.");
      setDeleting(false);
    }
  };

  const existingDisplay = displayName(existingClient);
  const email = existingClient.email ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
            This email is already in your contacts
          </DialogTitle>
          <DialogDescription>
            {email ? (
              <>
                <span className="font-medium text-neutral-900">{email}</span> is
                already attached to <span className="font-medium text-neutral-900">{existingDisplay}</span>
                {typedName.trim() ? <> in your CRM, not <span className="font-medium text-neutral-900">{typedName.trim()}</span></> : null}.
                What would you like to do?
              </>
            ) : (
              <>This email is already attached to {existingDisplay} in your CRM. What would you like to do?</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[13px]">
          <div className="flex items-center gap-2 font-medium text-neutral-900">
            <User className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
            {existingDisplay}
          </div>
          {email ? (
            <div className="mt-1 flex items-center gap-2 text-neutral-600">
              <Mail className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
              {email}
            </div>
          ) : null}
          {existingClient.phone ? (
            <div className="mt-1 flex items-center gap-2 text-neutral-600">
              <Phone className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
              {existingClient.phone}
            </div>
          ) : null}
        </div>

        {confirmingDelete ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
            Remove <span className="font-medium">{existingDisplay}</span> from
            your CRM? This only affects your contacts — if this buyer works with
            another agent, their account stays intact. Then you can re-add{" "}
            {typedName.trim() ? <span className="font-medium">{typedName.trim()}</span> : "the new contact"}{" "}
            with this email.
          </div>
        ) : null}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={deleting || adding}
            >
              Cancel
            </Button>
            {confirmingDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || adding}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                    Removing…
                  </>
                ) : (
                  "Yes, remove from my CRM"
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmingDelete(true)}
                disabled={deleting || adding}
                className="text-destructive hover:text-destructive"
              >
                Delete this contact
              </Button>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={deleting || adding}
          >
            {adding ? "Adding…" : `Add ${existingClient.first_name ?? "contact"} to hot sheet`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DuplicateContactDialog;