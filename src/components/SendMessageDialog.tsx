import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: "buyer_need" | "sales_intel" | "renter_need" | "general_discussion";
  categoryTitle: string;
}

export const SendMessageDialog = ({ open, onOpenChange, category, categoryTitle }: SendMessageDialogProps) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-client-need-notification", {
        body: {
          category,
          subject: subject.trim(),
          message: message.trim(),
        },
      });

      if (error) throw error;

      if (data?.recipientCount === 0) {
        toast.info("No agents have this notification preference enabled");
      } else {
        toast.success(
          `Message sent successfully to ${data.successCount} agent${data.successCount !== 1 ? "s" : ""}!`
        );
      }

      onOpenChange(false);
      setSubject("");
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Send {categoryTitle} Message</DialogTitle>
          <DialogDescription>
            Compose your message to send to agents interested in {categoryTitle.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter message subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
