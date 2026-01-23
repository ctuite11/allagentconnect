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
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_early_access?: boolean;
}

interface BulkDeleteAgentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  onDeleted: () => void;
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

    const { data: { user: currentUser } } = await supabase.auth.getUser();

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      setProgress(Math.round(((i + 1) / agents.length) * 100));

      try {
        // EARLY ACCESS BRANCH: Simple delete
        if (agent.is_early_access) {
          const { error } = await supabase
            .from("agent_early_access")
            .delete()
            .eq("id", agent.id);

          if (error) throw error;
          successCount++;
          continue;
        }

        // REAL AGENT BRANCH: Full deletion flow
        // Fetch full agent profile data for archival
        const { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("id", agent.id)
          .single();

        const { data: agentSettings } = await supabase
          .from("agent_settings")
          .select("*")
          .eq("user_id", agent.id)
          .single();

        // Archive the user
        await supabase
          .from("deleted_users")
          .insert({
            original_user_id: agent.id,
            email: agent.email,
            first_name: agent.first_name,
            last_name: agent.last_name,
            phone: agentProfile?.phone || null,
            company: agentProfile?.company || null,
            deleted_by: currentUser?.id || null,
            deletion_reason: "Bulk admin deletion",
            original_data: {
              agent_profile: agentProfile,
              agent_settings: agentSettings,
            },
          });

        // Delete in order to avoid FK constraints
        await supabase.from("agent_settings").delete().eq("user_id", agent.id);
        await supabase.from("user_roles").delete().eq("user_id", agent.id);
        await supabase.from("notification_preferences").delete().eq("user_id", agent.id);
        await supabase.from("agent_buyer_coverage_areas").delete().eq("agent_id", agent.id);
        await supabase.from("agent_county_preferences").delete().eq("agent_id", agent.id);
        await supabase.from("agent_state_preferences").delete().eq("agent_id", agent.id);
        await supabase.from("testimonials").delete().eq("agent_id", agent.id);
        await supabase.from("email_templates").delete().eq("agent_id", agent.id);
        await supabase.from("clients").delete().eq("agent_id", agent.id);
        await supabase.from("hot_sheets").delete().eq("user_id", agent.id);
        await supabase.from("favorites").delete().eq("user_id", agent.id);
        await supabase.from("listing_drafts").delete().eq("user_id", agent.id);
        await supabase.from("listings").delete().eq("agent_id", agent.id);
        await supabase.from("profiles").delete().eq("id", agent.id);
        await supabase.from("agent_profiles").delete().eq("id", agent.id);

        // Delete auth user
        await supabase.functions.invoke("delete-users", {
          body: { userIds: [agent.id] },
        });

        successCount++;
      } catch (error: any) {
        console.error(`Error deleting agent ${agent.email}:`, error);
        failCount++;
      }
    }

    setDeleting(false);
    setProgress(0);

    if (failCount === 0) {
      toast.success(`Successfully deleted ${successCount} agent(s)`);
    } else {
      toast.warning(`Deleted ${successCount} agent(s), ${failCount} failed`);
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
                <p className="text-amber-600 font-medium text-sm">
                  Users will be archived in the deleted users database.
                </p>
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
