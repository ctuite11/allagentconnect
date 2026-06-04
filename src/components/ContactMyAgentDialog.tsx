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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast as sonnerToast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSenderProfilePrefill } from "@/lib/currentSenderProfile";

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
  crmClientId: _crmClientId,
  agentUserId,
  agentDisplayName,
  defaultSubject,
}: Props) {
  const { toast } = useToast();
  const [subject, setSubject] = React.useState(
    "Message from your client via AllAgentConnect",
  );
  const [message, setMessage] = React.useState("");
  const [senderName, setSenderName] = React.useState("");
  const [senderEmail, setSenderEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const applySender = React.useCallback((sender: { name: string; email: string }) => {
    setSenderName((prev) => sender.name || prev);
    setSenderEmail((prev) => sender.email || prev);
  }, []);

  useSenderProfilePrefill(open, applySender, "buyer");

  const canSend = message.trim().length > 0;

  React.useEffect(() => {
    if (open) {
      setSubject(defaultSubject || "Message from your client via AllAgentConnect");
      setMessage("");
    }
  }, [open, defaultSubject]);

  async function handleSend() {
    if (!canSend) {
      sonnerToast.error("Please enter a message.");
      return;
    }

    console.log("[ContactMyAgentDialog] buyer dashboard email submit", {
      component: "ContactMyAgentDialog",
      path: "buyer-dashboard-contact-my-agent",
      agentUserId: agentUserId ?? null,
    });

    setSending(true);
    try {
      // Refresh so the access token is valid for edge-function auth.getUser(jwt).
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken =
        refreshed.session?.access_token ??
        (await supabase.auth.getSession()).data.session?.access_token;

      if (!accessToken) {
        toast({
          title: "Please sign in again",
          description: "Your session expired. Sign in again before sending this email.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-buyer-agent-email", {
        body: {
          subject: subject.trim(),
          message: message.trim(),
          ...(agentUserId ? { agentId: agentUserId } : {}),
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error || !data?.success) {
        const context = (error as { context?: Response } | null)?.context;
        const backendError = context
          ? await context
              .clone()
              .json()
              .then((body) => (typeof body?.error === "string" ? body.error : null))
              .catch(() => null)
          : null;

        sonnerToast.error(
          data?.error || backendError || error?.message || "Failed to send message",
        );
        return;
      }

      sonnerToast.success("Message sent to your agent");
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send message";
      sonnerToast.error(msg);
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
          <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sender</p>
            <div className="space-y-1.5">
              <Label htmlFor="buyer-email-sender-name" className="text-xs text-neutral-600">
                Your name
              </Label>
              <Input
                id="buyer-email-sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your full name"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyer-email-sender-email" className="text-xs text-neutral-600">
                Your email
              </Label>
              <Input
                id="buyer-email-sender-email"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={255}
              />
            </div>
            <p className="text-[11px] text-neutral-500">
              Replies from your agent will go to this address.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Message</label>
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
