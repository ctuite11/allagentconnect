import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { useSenderProfilePrefill } from "@/lib/currentSenderProfile";
import { TurnstileField } from "@/components/security/TurnstileField";
import { useTurnstile } from "@/hooks/useTurnstile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
  defaultName?: string;
}

const schema = z.object({
  senderName: z.string().trim().min(1, "Name is required").max(100),
  senderEmail: z.string().trim().email("Invalid email").max(255),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

export default function AccessErrorContactDialog({ open, onOpenChange, defaultEmail = "", defaultName = "" }: Props) {
  const [senderName, setSenderName] = useState(defaultName);
  const [senderEmail, setSenderEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile("contact_support", open);

  const applySender = useCallback(
    (sender: { name: string; email: string }) => {
      if (!defaultName) setSenderName(sender.name);
      if (!defaultEmail) setSenderEmail(sender.email);
    },
    [defaultEmail, defaultName],
  );

  useSenderProfilePrefill(open, applySender, "auto");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ senderName, senderEmail, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your inputs");
      return;
    }
    const turnstileToken = turnstile.requireToken();
    if (!turnstileToken) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          // Server hardcodes support inbox — never send a caller-chosen destination.
          purpose: "support",
          senderName: parsed.data.senderName,
          senderEmail: parsed.data.senderEmail,
          message: parsed.data.message,
          listingAddress: "Access Error — Support Request",
          turnstile_token: turnstileToken,
        },
      });
      if (error) throw error;
      toast.success("Message sent — we'll be in touch shortly.");
      setMessage("");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Contact support error:", err);
      toast.error(err?.message || "Failed to send message. Please try again.");
      turnstile.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
          <DialogDescription>
            Send a message to the AAC team and we'll get back to you shortly.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="ae-name">Your name</Label>
            <Input id="ae-name" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Jane Smith" required />
          </div>
          <div>
            <Label htmlFor="ae-email">Email</Label>
            <Input id="ae-email" type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <Label htmlFor="ae-message">Message</Label>
            <Textarea id="ae-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what's happening…" rows={5} required />
          </div>
          <TurnstileField containerRef={turnstile.containerRef} error={turnstile.error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Send message</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
