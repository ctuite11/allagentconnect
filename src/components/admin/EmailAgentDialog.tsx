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
import { Loader2, Mail, Users } from "lucide-react";

interface EmailAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Array<{ id: string; email: string; name: string }>;
}

export function EmailAgentDialog({ open, onOpenChange, recipients }: EmailAgentDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to send emails");
        return;
      }

      const { error } = await supabase.functions.invoke("send-bulk-email", {
        body: {
          recipients: recipients.map((r) => ({ email: r.email, name: r.name })),
          subject: subject.trim(),
          message: message.trim(),
          agentId: user.id,
          sendAsGroup: false,
        },
      });

      if (error) throw error;

      toast.success(`Email sent to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}`);
      setSubject("");
      setMessage("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email: " + (error.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const isBulk = recipients.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] rounded-2xl border-slate-200 bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-[#F7F6F3] border border-slate-200">
              {isBulk ? <Users className="h-5 w-5 text-slate-600" /> : <Mail className="h-5 w-5 text-slate-600" />}
            </div>
            <DialogTitle className="text-foreground">
              {isBulk ? "Email Selected Agents" : "Email Agent"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            {isBulk 
              ? `Sending to ${recipients.length} agents. Each will receive a separate email.`
              : `Send an email to ${recipients[0]?.name}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipients Preview */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Recipients</Label>
            <div className="max-h-24 overflow-y-auto p-3 rounded-xl border border-slate-200 bg-[#FAFAF8]">
              {recipients.map((recipient) => (
                <div key={recipient.id} className="flex items-center gap-2 text-sm py-0.5">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{recipient.name}</span>
                  <span className="text-muted-foreground">({recipient.email})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject *</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="border-slate-200"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-message">Message *</Label>
            <Textarea
              id="email-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              rows={6}
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
            disabled={sending || !subject.trim() || !message.trim()}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
