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

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_early_access?: boolean;
  source?: "profile" | "early_access" | "pending_verification";
  pending_verification_id?: string;
}

interface BulkDeleteAgentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  /** Receives the ids whose application records were removed. */
  onDeleted: (removedIds?: string[]) => void;
}

export function BulkDeleteAgentsDialog({ 
  open, 
  onOpenChange, 
  agents, 
  onDeleted 
}: BulkDeleteAgentsDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleBulkDelete = async () => {
    if (agents.length === 0) return;

    setDeleting(true);
    setProgress(0);

    // Ids whose DB rows were removed — used to drop them from the list
    // immediately, even if a later step throws.
    const removedIds: string[] = [];

    try {
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    let fullCount = 0;      // DB + auth both removed
    let partialCount = 0;   // DB removed, auth deletion queued for retry
    let failCount = 0;      // nothing removed
    const partialEmails: string[] = [];


    const pendingRequests = agents.filter((a) => a.source === "pending_verification");
    const earlyAccess = agents.filter(
      (a) => a.source !== "pending_verification" && a.is_early_access,
    );
    const realAgents = agents.filter(
      (a) => a.source !== "pending_verification" && !a.is_early_access,
    );

    // Track which agents made it through DB cleanup and should be sent to
    // the batched delete-users edge function.
    const authTargets: { userId: string; email: string }[] = [];
    const dbFailedEmails = new Set<string>();

    setProgress(15);

    // --- Phase 1a: bulk-fetch real-agent profiles for the archive insert ---
    let profilesById: Record<string, Record<string, unknown>> = {};
    if (realAgents.length > 0) {
      const { data: profiles } = await supabase
        .from("agent_profiles")
        .select("*")
        .in("id", realAgents.map((a) => a.id));
      if (profiles) {
        profilesById = Object.fromEntries(
          profiles.map((p) => [p.id as string, p as Record<string, unknown>]),
        );
      }

      // Bulk archive insert (best-effort — matches prior non-throwing behavior).
      const archiveRows = realAgents.map((agent) => {
        const profile = profilesById[agent.id];
        return {
          original_user_id: agent.id,
          email: agent.email,
          first_name: agent.first_name,
          last_name: agent.last_name,
          phone: (profile?.phone as string | null) ?? null,
          company: (profile?.company as string | null) ?? null,
          deleted_by: currentUser?.id || null,
          deletion_reason: "Bulk admin deletion",
          original_data: { agent_profile: (profile ?? null) as unknown } as never,
        };
      });
      await supabase.from("deleted_users").insert(archiveRows);

      // Fire removal-notice emails in parallel (best-effort, never throws).
      await Promise.allSettled(
        realAgents.map((agent) =>
          enqueueVerifiedInactiveAgentRemovalEmail({
            agentId: agent.id,
            email: agent.email,
            firstName: agent.first_name,
          }),
        ),
      );
    }

    setProgress(40);

    // Request-only rows are removed through the canonical cleanup RPC. This
    // also clears stale blockers only when no real account identity exists.
    const requestResults = await Promise.allSettled(
      pendingRequests.map((agent) =>
        supabase.rpc("admin_delete_pending_verification", {
          p_id: agent.pending_verification_id ?? agent.id,
          p_email: agent.email,
        }),
      ),
    );
    requestResults.forEach((res, idx) => {
      const agent = pendingRequests[idx];
      const result = res.status === "fulfilled"
        ? (res.value.data as { deleted_requests?: number; fully_reinvitable?: boolean } | null)
        : null;
      if (
        res.status === "fulfilled" &&
        !res.value.error &&
        result?.deleted_requests &&
        result.fully_reinvitable === true
      ) {
        fullCount++;
      } else {
        const err = res.status === "rejected" ? res.reason : res.value.error;
        console.error(`Error deleting verification request ${agent.email}:`, err);
        dbFailedEmails.add(agent.email);
        failCount++;
      }
    });

    // --- Phase 1b: run all admin_delete_agent RPCs in parallel ---
    const realResults = await Promise.allSettled(
      realAgents.map((agent) =>
        supabase.rpc("admin_delete_agent", { p_agent_id: agent.id }),
      ),
    );
    realResults.forEach((res, idx) => {
      const agent = realAgents[idx];
      if (res.status === "fulfilled" && !res.value.error) {
        const handoff = (res.value.data ?? {}) as { auth_user_id?: string | null };
        authTargets.push({
          userId: handoff.auth_user_id ?? agent.id,
          email: agent.email,
        });
      } else {
        const err = res.status === "rejected" ? res.reason : res.value.error;
        console.error(`Error deleting agent ${agent.email}:`, err);
        dbFailedEmails.add(agent.email);
        failCount++;
      }
    });

    // --- Phase 1c: run all early-access deletes in parallel ---
    const eaResults = await Promise.allSettled(
      earlyAccess.map((agent) =>
        supabase.rpc("admin_delete_early_access", {
          p_id: agent.id,
          p_email: agent.email,
        }),
      ),
    );
    eaResults.forEach((res, idx) => {
      const agent = earlyAccess[idx];
      if (
        res.status === "fulfilled" &&
        !res.value.error &&
        res.value.data &&
        (res.value.data as number) > 0
      ) {
        authTargets.push({ userId: agent.id, email: agent.email });
      } else {
        const err =
          res.status === "rejected"
            ? res.reason
            : res.value.error ?? new Error("No row removed");
        console.error(`Error deleting early-access ${agent.email}:`, err);
        dbFailedEmails.add(agent.email);
        failCount++;
      }
    });

    setProgress(75);

    // --- Phase 2: single batched delete-users call for all successful DB rows ---
    if (authTargets.length > 0) {
      try {
        const result = await invokeEdgeFunction<DeleteUsersResult>("delete-users", {
          targets: authTargets,
          userIds: authTargets.map((t) => t.userId),
          emails: authTargets.map((t) => t.email),
        });

        const perTarget = new Map<string, "deleted" | "already_absent" | "failed">();
        for (const r of result.results ?? []) {
          if (r.email) perTarget.set(r.email.toLowerCase(), r.status);
        }

        for (const target of authTargets) {
          const status = perTarget.get(target.email.toLowerCase());
          if (!status || status === "deleted" || status === "already_absent") {
            fullCount++;
          } else {
            partialCount++;
            partialEmails.push(target.email);
          }
        }
      } catch (authError) {
        // Outbox rows from the RPCs guarantee automatic retry.
        console.error("Batch auth deletion pending:", authError);
        for (const target of authTargets) {
          partialCount++;
          partialEmails.push(target.email);
        }
      }
    }

    setProgress(100);

    setDeleting(false);
    setProgress(0);

    if (failCount === 0 && partialCount === 0) {
      toast.success(`Successfully deleted ${fullCount} agent(s)`);
    } else if (failCount === 0) {
      toast.warning(
        `${fullCount} agent(s) fully deleted. For ${partialCount} agent(s) (${partialEmails.join(", ")}), application records were removed but the login account could not be deleted yet — queued for automatic retry.`,
        { duration: 15000 },
      );
    } else {
      toast.error(
        `${fullCount} fully deleted, ${partialCount} pending login-account cleanup${partialEmails.length ? ` (${partialEmails.join(", ")})` : ""}, ${failCount} failed entirely. Check the console for details.`,
        { duration: 15000 },
      );
    }

    onDeleted();
    onOpenChange(false);
  };

  if (agents.length === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-neutral-200 bg-white">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-rose-100 border border-rose-200">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-foreground">
              Delete {agents.length} Agent{agents.length > 1 ? "s" : ""}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-muted-foreground">
              Are you sure you want to delete the following agents?
              <div className="mt-3 max-h-40 overflow-y-auto bg-zinc-50 rounded-lg p-2 text-sm">
                {agents.map((agent) => (
                  <div key={agent.id} className="py-1">
                    <span className="font-medium">{agent.first_name} {agent.last_name}</span>
                    <span className="text-zinc-400 ml-2">({agent.email})</span>
                    {agent.is_early_access && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        Early Access
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {agents.some(
                  (agent) => agent.source !== "pending_verification" && !agent.is_early_access,
                ) && (
                  <p className="text-amber-600 font-medium text-sm">
                    Existing agents will be archived in the deleted users database.
                  </p>
                )}
                <p className="text-rose-600 font-medium text-sm">
                  This action cannot be undone.
                </p>
              </div>
              {deleting && (
                <div className="mt-4">
                  <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 text-center">{progress}% complete</p>
                </div>
              )}
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
            onClick={handleBulkDelete}
            disabled={deleting}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete {agents.length} Agent{agents.length > 1 ? "s" : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
