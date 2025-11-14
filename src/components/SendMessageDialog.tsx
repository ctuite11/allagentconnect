import { useState, useEffect } from "react";
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
import { Send, Users } from "lucide-react";
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
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  const fetchRecipientCount = async () => {
    setLoadingCount(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch agents with this preference enabled (excluding self)
      const query = supabase
        .from("notification_preferences")
        .select("user_id")
        .neq("user_id", user.id);

      // Type assertion to handle dynamic column name
      const { data, error } = await (query as any).eq(category, true);

      if (error) throw error;

      setRecipientCount(data?.length || 0);
    } catch (error) {
      console.error("Error fetching recipient count:", error);
      setRecipientCount(0);
    } finally {
      setLoadingCount(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRecipientCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

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
        
        {/* Recipient Count Preview */}
        {!loadingCount && recipientCount !== null && (
          <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {recipientCount === 0 ? (
                "No agents will receive this message"
              ) : (
                <>
                  This message will be sent to <strong className="text-foreground">{recipientCount}</strong> agent{recipientCount !== 1 ? "s" : ""}
                </>
              )}
            </span>
          </div>
        )}
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
