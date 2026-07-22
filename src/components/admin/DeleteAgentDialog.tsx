import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { enqueueVerifiedInactiveAgentRemovalEmail } from "@/lib/enqueueVerifiedInactiveAgentRemovalEmail";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

interface DeleteUsersResult {
  success: true;
  fullyDeleted?: boolean;
  partialFailure?: boolean;
  deleted: number;
  results?: Array<{
    status: "deleted" | "already_absent" | "failed";
    email?: string | null;
    stage?: string;
    reason?: string;
    queuedForRetry?: boolean;
  }>;
}

interface DeleteAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: { 
    id: string; 
    first_name: string; 
    last_name: string; 
    email: string;
    is_early_access?: boolean;
  } | null;
  onDeleted: () => void;
}

export function DeleteAgentDialog({ open, onOpenChange, agent, onDeleted }: DeleteAgentDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!agent) return;

    setDeleting(true);
    try {
      // EARLY ACCESS BRANCH: Simple delete from agent_early_access only
      if (agent.is_early_access) {
        const { data: rowsDeleted, error } = await supabase.rpc(
          "admin_delete_early_access",
          { p_id: agent.id }
        );
        if (error) throw error;
        if (!rowsDeleted || rowsDeleted === 0) {
          throw new Error(
            "No row was removed. You may not have admin permission, or the record was already deleted. Refresh and try again."
          );
        }

        try {
          const result = await invokeEdgeFunction<DeleteUsersResult>("delete-users", {
            emails: [agent.email],
          });
          if (result.fullyDeleted ?? true) {
            toast.success(`${agent.first_name} ${agent.last_name} (early access) has been deleted`);
          } else {
            toast.warning(
              `${agent.first_name} ${agent.last_name} (early access) removed, but the login account could not be deleted yet. It has been queued for automatic retry.`,
              { duration: 12000 },
            );
          }
        } catch (authError) {
          console.error("Error purging auth user:", authError);
          toast.warning(
            `${agent.first_name} ${agent.last_name} (early access) removed, but login-account cleanup failed. It has been queued for automatic retry.`,
            { duration: 12000 },
          );
        }
        onDeleted();
        onOpenChange(false);
        return;
      }

      // REAL AGENT BRANCH: Server-side RPC handles full cleanup
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Notify verified-but-never-activated agents before rows are deleted
      // so agent_settings.verified / account_activated_at are still readable.
      await enqueueVerifiedInactiveAgentRemovalEmail({
        agentId: agent.id,
        email: agent.email,
        firstName: agent.first_name,
      });

      // Archive before deletion
      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", agent.id)
        .single();

      await supabase.from("deleted_users").insert({
        original_user_id: agent.id,
        email: agent.email,
        first_name: agent.first_name,
        last_name: agent.last_name,
        phone: agentProfile?.phone || null,
        company: agentProfile?.company || null,
        deleted_by: currentUser?.id || null,
        deletion_reason: "Admin deletion",
        original_data: { agent_profile: agentProfile },
      });

      // Single RPC cleans all DB records AND enqueues the auth deletion in
      // the same transaction. It returns the canonical auth user id, which
      // may differ from agent_profiles.id on legacy accounts.
      const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_delete_agent", {
        p_agent_id: agent.id,
      });
      if (rpcErr) throw rpcErr;

      const handoff = (rpcData ?? {}) as { auth_user_id?: string | null; email?: string | null };
      const canonicalAuthId = handoff.auth_user_id ?? agent.id;

      // Purge auth user now. If this fails, the outbox row written by the RPC
      // guarantees an automatic retry — no ghost account.
      try {
        // targets = new structured shape; userIds/emails kept for back-compat
        // with a previously deployed function version. Duplicates are deduped
        // server-side by resolved auth id.
        const result = await invokeEdgeFunction<DeleteUsersResult>("delete-users", {
          targets: [{ userId: canonicalAuthId, email: agent.email }],
          userIds: [canonicalAuthId],
          emails: [agent.email],
        });
        // Legacy function versions have no fullyDeleted field; for them,
        // success:true (already guaranteed here) meant all targets deleted.
        if (result.fullyDeleted ?? true) {
          toast.success(`${agent.first_name} ${agent.last_name} has been permanently deleted and archived`);
        } else {
          const failed = result.results?.find((r) => r.status === "failed");
          toast.warning(
            `Application records for ${agent.first_name} ${agent.last_name} were removed, but the login account (${agent.email}) could not be deleted${failed?.reason ? ` — ${failed.reason}` : ""}. It has been queued for automatic retry.`,
            { duration: 12000 },
          );
        }
      } catch (authError) {
        console.error("Error deleting auth user:", authError);
        toast.warning(
          `Application records for ${agent.first_name} ${agent.last_name} were removed, but the login account (${agent.email}) could not be deleted yet. It has been queued for automatic retry.`,
          { duration: 12000 },
        );
      }

      onDeleted();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setDeleting(false);
    }
  };

  if (!agent) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-neutral-200 bg-white">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-rose-100 border border-rose-200">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-foreground">Delete Agent</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-muted-foreground">
              Are you sure you want to delete <strong>{agent.first_name} {agent.last_name}</strong> ({agent.email})?
              <br /><br />
              This will permanently remove:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Their agent profile and settings</li>
                <li>All their listings</li>
                <li>All their clients and hot sheets</li>
                <li>Their auth account</li>
              </ul>
              <br />
              <span className="text-amber-600 font-medium">The user will be archived in the deleted users database for record keeping.</span>
              <br />
              <span className="text-rose-600 font-medium">This action cannot be undone.</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={deleting}
            className="rounded-xl border-neutral-200"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Agent
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}