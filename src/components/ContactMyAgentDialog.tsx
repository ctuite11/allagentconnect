import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** @deprecated No longer required — kept for backward compat with CRM-based callers */
  crmClientId?: string;
  /** Auth user id of the buyer's representing agent (sticky agent). */
  agentUserId?: string | null;
  agentDisplayName?: string | null;
  defaultSubject?: string;
};

export function ContactMyAgentDialog({
  open,
  onOpenChange,
  crmClientId,
  agentUserId,
  agentDisplayName,
  defaultSubject,
}: Props) {
  const [subject, setSubject] = React.useState(
    "Message from your client via AllAgentConnect"
  );
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const canSend = message.trim().length > 0;

  React.useEffect(() => {
    if (open) {
      setSubject(defaultSubject || "Message from your client via AllAgentConnect");
      setMessage("");
    }
  }, [open, defaultSubject]);

  async function handleSend() {
    if (!canSend) {
      toast.error("Please enter a message.");
      return;
    }

    setSending(true);
    try {
      await invokeEdgeFunction("send-buyer-agent-email", {
        subject: subject.trim(),
        message: message.trim(),
        ...(agentUserId ? { agentId: agentUserId } : {}),
      });

      toast.success("Message sent to your agent");
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send message";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact My Agent</DialogTitle>
          <DialogDescription>
            This sends an email to {agentDisplayName || "your agent"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message…"
              rows={8}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={!canSend || sending}>
              {sending ? "Sending…" : "Send Email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
