import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSenderProfilePrefill } from "@/lib/currentSenderProfile";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

interface AgentEmailQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  agentEmail: string;
}

/**
 * Authenticated quick-email dialog used from AgentIntelDrawer (Comms Center).
 * Sender identity is pulled from the signed-in agent profile — never asked for.
 * Payload matches the send-agent-profile-contact edge function contract:
 *   { agentEmail, agentName, senderName, senderEmail, subject, message }.
 */
export function AgentEmailQuickDialog({
  open,
  onOpenChange,
  agentName,
  agentEmail,
}: AgentEmailQuickDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  const applySender = useCallback((sender: { name: string; email: string }) => {
    setSenderName((prev) => sender.name || prev);
    setSenderEmail((prev) => sender.email || prev);
  }, []);

  useSenderProfilePrefill(open, applySender, "agent");

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message");
      return;
    }
    if (!agentEmail) {
      toast.error("Recipient email is missing.");
      return;
    }

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        toast.error("Please sign in again");
        return;
      }

      await invokeEdgeFunction("send-agent-profile-contact", {
        agentEmail,
        agentName,
        senderName: senderName.trim() || user.email?.split("@")[0] || "All Agent Connect",
        senderEmail: senderEmail.trim() || user.email || "",
        subject: subject.trim(),
        message: message.trim(),
      });

      toast.success(`Email sent to ${agentName}`);
      setSubject("");
      setMessage("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email: " + (error?.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl border-slate-200 bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-[#F7F6F3] border border-slate-200">
              <Mail className="h-5 w-5 text-slate-600" />
            </div>
            <DialogTitle className="text-foreground">Email Agent</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            {agentName ? `Send an email to ${agentName}` : "Send an email"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">To</Label>
            <div className="rounded-lg border border-slate-200 bg-[#FAFAF8] px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{agentName}</span>
                {agentEmail && (
                  <span className="text-muted-foreground">&lt;{agentEmail}&gt;</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-email-subject">Subject *</Label>
            <Input
              id="agent-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="border-slate-200"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-email-message">Message *</Label>
            <Textarea
              id="agent-email-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              rows={7}
              className="border-slate-200 resize-none"
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/5000</p>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim() || !agentEmail}
            className="rounded-xl bg-[#0E56F5] hover:bg-[#0E56F5]/90 text-white"
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AgentEmailQuickDialog;