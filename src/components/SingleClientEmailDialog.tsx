import { useState } from "react";
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
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

interface SingleClientEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  recipientEmail: string;
  recipientName?: string;
}

/**
 * Individual buyer email composer.
 * Enqueues exactly one transactional row in `email_jobs` via the
 * `send-agent-client-email` edge function (which kicks `kick-email-queue`).
 * Does NOT use `send-bulk-email` and does NOT attach any marketing category.
 */
export function SingleClientEmailDialog({
  open,
  onOpenChange,
  clientId,
  recipientEmail,
  recipientName,
}: SingleClientEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => {
    setSubject("");
    setMessage("");
  };

  const handleSend = async () => {
    const s = subject.trim();
    const m = message.trim();
    if (!s || !m) {
      toast.error("Please fill in both subject and message");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-agent-client-email", {
        body: {
          clientId,
          recipientEmail,
          recipientName,
          subject: s,
          message: m,
        },
      });
      if (error) throw error;
      if (data && (data as { success?: boolean }).success === false) {
        throw new Error((data as { error?: string }).error || "Send failed");
      }
      toast.success(`Email sent to ${recipientName?.trim() || recipientEmail}`);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error sending client email:", err);
      toast.error("Failed to send email: " + (err?.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] rounded-2xl border-slate-200 bg-white">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-[#F7F6F3] p-2">
              <Mail className="h-5 w-5 text-slate-600" />
            </div>
            <DialogTitle className="text-foreground">Email Client</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Sending to {recipientName?.trim() || recipientEmail}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Recipient</Label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#FAFAF8] px-3 py-2 text-sm">
              <Mail className="h-3 w-3 text-muted-foreground" />
              {recipientName?.trim() ? (
                <span className="font-medium">{recipientName.trim()}</span>
              ) : null}
              <span className="text-muted-foreground">({recipientEmail})</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="single-email-subject">Subject *</Label>
            <Input
              id="single-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="border-slate-200"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="single-email-message">Message *</Label>
            <Textarea
              id="single-email-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              rows={8}
              className="resize-none border-slate-200"
              maxLength={5000}
            />
            <p className="text-right text-xs text-muted-foreground">{message.length}/5000</p>
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
            disabled={sending || !subject.trim() || !message.trim()}
            className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}