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

interface DeleteAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: { id: string; first_name: string; last_name: string; email: string } | null;
  onDeleted: () => void;
}

export function DeleteAgentDialog({ open, onOpenChange, agent, onDeleted }: DeleteAgentDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!agent) return;

    setDeleting(true);
    try {
      // Delete in order to avoid FK constraints:
      // 1. Delete from agent_settings
      await supabase.from("agent_settings").delete().eq("user_id", agent.id);
      
      // 2. Delete from user_roles
      await supabase.from("user_roles").delete().eq("user_id", agent.id);
      
      // 3. Delete from notification_preferences
      await supabase.from("notification_preferences").delete().eq("user_id", agent.id);
      
      // 4. Delete from agent_buyer_coverage_areas
      await supabase.from("agent_buyer_coverage_areas").delete().eq("agent_id", agent.id);
      
      // 5. Delete from agent_county_preferences
      await supabase.from("agent_county_preferences").delete().eq("agent_id", agent.id);
      
      // 6. Delete from agent_state_preferences
      await supabase.from("agent_state_preferences").delete().eq("agent_id", agent.id);
      
      // 7. Delete from testimonials
      await supabase.from("testimonials").delete().eq("agent_id", agent.id);
      
      // 8. Delete from email_templates
      await supabase.from("email_templates").delete().eq("agent_id", agent.id);
      
      // 9. Delete from clients
      await supabase.from("clients").delete().eq("agent_id", agent.id);
      
      // 10. Delete from hot_sheets
      await supabase.from("hot_sheets").delete().eq("user_id", agent.id);
      
      // 11. Delete from favorites
      await supabase.from("favorites").delete().eq("user_id", agent.id);
      
      // 12. Delete from listing_drafts
      await supabase.from("listing_drafts").delete().eq("user_id", agent.id);
      
      // 13. Delete listings (this will cascade to listing-related tables)
      await supabase.from("listings").delete().eq("agent_id", agent.id);
      
      // 14. Finally delete from agent_profiles
      const { error: profileError } = await supabase
        .from("agent_profiles")
        .delete()
        .eq("id", agent.id);

      if (profileError) throw profileError;

      // 15. Delete auth user via edge function
      const { error: authError } = await supabase.functions.invoke("delete-users", {
        body: { userIds: [agent.id] },
      });

      if (authError) {
        console.error("Error deleting auth user:", authError);
        // Don't throw here - the profile is already deleted
      }

      toast.success(`${agent.first_name} ${agent.last_name} has been deleted`);
      onDeleted();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!agent) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-slate-200 bg-white">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-rose-100 border border-rose-200">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-foreground">Delete Agent</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground">
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
            <span className="text-rose-600 font-medium">This action cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={deleting}
            className="rounded-xl border-slate-200"
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
