import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AgentChoiceDialogProps {
  open: boolean;
  existingAgent: any;
  newAgent: any;
  clientId: string;
  existingRelationshipId: string;
  newRelationshipId: string;
  onChoice: (switchedToNew: boolean) => void;
}

export function AgentChoiceDialog({
  open,
  existingAgent,
  newAgent,
  clientId,
  existingRelationshipId,
  newRelationshipId,
  onChoice,
}: AgentChoiceDialogProps) {
  const [processing, setProcessing] = useState(false);

  const handleSwitchAgent = async () => {
    try {
      setProcessing(true);

      // End existing relationship
      const { error: endError } = await supabase
        .from("client_agent_relationships")
        .update({
          status: "inactive",
          ended_at: new Date().toISOString(),
        })
        .eq("id", existingRelationshipId);

      if (endError) throw endError;

      // Activate new relationship
      const { error: activateError } = await supabase
        .from("client_agent_relationships")
        .update({ status: "active" })
        .eq("id", newRelationshipId);

      if (activateError) throw activateError;

      toast.success(`You're now working with ${newAgent.first_name}`);
      onChoice(true);
    } catch (error: any) {
      console.error("Error switching agents:", error);
      toast.error("Failed to switch agents");
    } finally {
      setProcessing(false);
    }
  };

  const handleStayWithCurrent = async () => {
    try {
      setProcessing(true);

      // Decline new relationship
      const { error } = await supabase
        .from("client_agent_relationships")
        .update({ status: "declined" })
        .eq("id", newRelationshipId);

      if (error) throw error;

      toast.success(`You've chosen to remain with ${existingAgent.first_name}`);
      onChoice(false);
    } catch (error: any) {
      console.error("Error declining invitation:", error);
      toast.error("Failed to process choice");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose Your Agent</DialogTitle>
          <DialogDescription className="text-base pt-2">
            You're already working with {existingAgent.first_name} {existingAgent.last_name} on All Agent Connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Existing Agent Card */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <p className="text-sm font-medium mb-3 text-muted-foreground">Current Agent</p>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={existingAgent.headshot_url || ""} />
                <AvatarFallback className="text-lg">
                  {existingAgent.first_name?.[0]}{existingAgent.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-lg">
                  {existingAgent.first_name} {existingAgent.last_name}
                </p>
                {existingAgent.company && (
                  <p className="text-sm text-muted-foreground">{existingAgent.company}</p>
                )}
                {existingAgent.email && (
                  <p className="text-sm text-muted-foreground">{existingAgent.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* New Agent Card */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <p className="text-sm font-medium mb-3 text-muted-foreground">New Invitation From</p>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={newAgent.headshot_url || ""} />
                <AvatarFallback className="text-lg">
                  {newAgent.first_name?.[0]}{newAgent.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-lg">
                  {newAgent.first_name} {newAgent.last_name}
                </p>
                {newAgent.company && (
                  <p className="text-sm text-muted-foreground">{newAgent.company}</p>
                )}
                {newAgent.email && (
                  <p className="text-sm text-muted-foreground">{newAgent.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
            <p className="text-sm">
              <strong>If you accept this new invitation:</strong>
            </p>
            <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
              <li>Your relationship with {existingAgent.first_name} will end</li>
              <li>{newAgent.first_name} will become your new primary agent on All Agent Connect</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleStayWithCurrent}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Stay with ${existingAgent.first_name}`
              )}
            </Button>
            <Button
              className="flex-1"
              onClick={handleSwitchAgent}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Switch to ${newAgent.first_name}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
