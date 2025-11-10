import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail } from "lucide-react";

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Array<{ email: string; name: string }>;
}

export function BulkEmailDialog({ open, onOpenChange, recipients }: BulkEmailDialogProps) {
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
      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          recipients: recipients,
          subject: subject,
          message: message,
        },
      });

      if (error) throw error;

      toast.success(`Email sent to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`);
      setSubject("");
      setMessage("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending bulk email:", error);
      toast.error("Failed to send email: " + (error.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Bulk Email</DialogTitle>
          <DialogDescription>
            Sending to {recipients.length} recipient{recipients.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Recipients</Label>
            <div className="max-h-32 overflow-y-auto p-3 rounded-md border bg-muted/30">
              {recipients.map((recipient, index) => (
                <div key={index} className="flex items-center gap-2 text-sm mb-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{recipient.name}</span>
                  <span className="text-muted-foreground">({recipient.email})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              rows={8}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">{message.length}/5000</p>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || !subject.trim() || !message.trim()}>
              {sending ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
