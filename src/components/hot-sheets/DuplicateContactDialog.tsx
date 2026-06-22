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
  const [checkingAccepted, setCheckingAccepted] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmingDelete(false);
      setDeleting(false);
      setAdding(false);
      setHasAccepted(false);
      setCheckingAccepted(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !existingClient?.id) return;
    let cancelled = false;
    setCheckingAccepted(true);
    setHasAccepted(false);
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const agentId = auth?.user?.id;
        if (!agentId) {
          if (!cancelled) setCheckingAccepted(false);
          return;
        }
        const { data, error } = await supabase
          .from("client_agent_relationships")
          .select("id")
          .eq("agent_id", agentId)
          .eq("crm_client_id", existingClient.id)
          .eq("status", "active")
          .not("client_id", "is", null)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.warn("[DuplicateContactDialog] accepted lookup failed", error);
          setHasAccepted(false);
        } else {
          setHasAccepted(Boolean(data));
        }
      } finally {
        if (!cancelled) setCheckingAccepted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, existingClient?.id]);

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
      // Backend RPC handles ending the relationship and any safe cleanup of
      // relationship rows that reference this CRM contact. The browser must
      // NOT delete from client_agent_relationships directly — there is no
      // delete policy for that table, and direct deletes surface as
      // "Could not delete this contact from your CRM."
      const { error: rpcError } = await supabase.rpc("agent_end_client_relationship", {
        p_client_id: existingClient.id,
      });
      if (rpcError) {
        console.error("[DuplicateContactDialog] end relationship failed", rpcError);
        toast.error("Could not delete this contact from your CRM.");
        setDeleting(false);
        return;
      }
      // Only delete the CRM row if it is safe — i.e. this agent still owns
      // an orphan CRM contact with no remaining active relationship rows
      // referencing it. Otherwise rely on the RPC's soft-remove and leave
      // the row intact. Any failure here is non-fatal; the duplicate lookup
      // is keyed on this agent's CRM row, which the RPC has already neutralized.
      const { data: orphanRow, error: orphanLookupError } = await supabase
        .from("clients")
        .select("id, agent_id")
        .eq("id", existingClient.id)
        .maybeSingle();
      if (orphanLookupError) {
        console.error("[DuplicateContactDialog] orphan lookup failed", orphanLookupError);
      } else if (orphanRow) {
        const { data: remainingRels, error: remainingRelsError } = await supabase
          .from("client_agent_relationships")
          .select("id")
          .eq("crm_client_id", existingClient.id)
          .limit(1);
        if (remainingRelsError) {
          console.error(
            "[DuplicateContactDialog] remaining relationships lookup failed",
            remainingRelsError,
          );
        } else if (!remainingRels || remainingRels.length === 0) {
          const { error: deleteError } = await supabase
            .from("clients")
            .delete()
            .eq("id", existingClient.id);
          if (deleteError) {
            console.error("[DuplicateContactDialog] delete CRM row failed", deleteError);
            // Non-fatal: RPC already soft-removed the contact for this agent.
          }
        }
      }
      invalidateAgentContactsCache();
      toast.success("Contact removed from your CRM.");
      await onDeleted();
    } catch (err) {
      console.error("[DuplicateContactDialog] unexpected error", err);
      toast.error("Could not delete this contact from your CRM.");
      setDeleting(false);
    }
  };

  const existingDisplay = displayName(existingClient);
  const email = existingClient.email ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
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

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={deleting || adding}
            >
              Back to form
            </Button>
            {confirmingDelete ? (
              <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting || adding}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || adding}
                className="whitespace-nowrap"
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                    Removing…
                  </>
                ) : (
                  "Remove from CRM"
                )}
              </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmingDelete(true)}
                disabled={deleting || adding}
                className="whitespace-nowrap text-destructive hover:text-destructive"
              >
                Delete contact
              </Button>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={deleting || adding || checkingAccepted}
            className="whitespace-nowrap"
          >
            {checkingAccepted
              ? "Checking…"
              : adding
                ? "Sending…"
                : hasAccepted
                  ? "Send hot sheet"
                  : "Send this hotsheet with invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DuplicateContactDialog;