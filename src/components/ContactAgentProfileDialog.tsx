import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import {
  getCurrentSenderProfile,
  type SenderProfile,
} from "@/lib/currentSenderProfile";

const contactMessageSchema = z.object({
  sender_name: z.string().trim().min(1, "Please enter your name").max(100),
  sender_email: z.string().trim().email("Invalid email address").max(255),
  message: z.string().trim().max(1000).optional(),
  subject: z.string().trim().min(1, "Please enter a subject").max(200),
});

const EMPTY_FORM = {
  sender_name: "",
  sender_email: "",
  subject: "",
  message: "",
};

interface ContactAgentProfileDialogProps {
  agentId: string;
  agentName: string;
  agentEmail: string;
  buttonText?: string;
  triggerClassName?: string;
  /** Logged-in viewer sender — skips fetch when provided. */
  initialSender?: SenderProfile | null;
}

const ContactAgentProfileDialog = ({
  agentId: _agentId,
  agentName,
  agentEmail,
  buttonText = "Contact Agent",
  triggerClassName,
  initialSender = null,
}: ContactAgentProfileDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const prefillSenderFields = useCallback(async () => {
    if (initialSender?.name || initialSender?.email) {
      setFormData((prev) => ({
        ...prev,
        sender_name: initialSender.name || prev.sender_name,
        sender_email: initialSender.email || prev.sender_email,
      }));
      return;
    }

    const sender = await getCurrentSenderProfile({ source: "auto" });
    if (!sender) return;

    setFormData((prev) => ({
      ...prev,
      sender_name: sender.name || prev.sender_name,
      sender_email: sender.email || prev.sender_email,
    }));
  }, [initialSender]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void prefillSenderFields();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = contactMessageSchema.parse(formData);

      setLoading(true);

      try {
        await supabase.functions.invoke("send-agent-profile-contact", {
          body: {
            agentEmail: agentEmail,
            agentName: agentName,
            senderName: validatedData.sender_name,
            senderEmail: validatedData.sender_email,
            message: validatedData.message,
            subject: validatedData.subject,
          },
        });
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        toast.error("Failed to send message. Please try again.");
        return;
      }

      toast.success("Message sent successfully. The agent will follow up soon.");
      setOpen(false);
      setFormData(EMPTY_FORM);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast.error("Failed to send message. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className={cn("gap-2 rounded-lg", triggerClassName)}>
          <Mail className="h-4 w-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "rounded-2xl border-neutral-200/90 sm:max-w-[500px]",
          "[&_input]:focus-visible:border-neutral-900 [&_input]:focus-visible:ring-1 [&_input]:focus-visible:ring-neutral-300/80",
          "[&_textarea]:focus-visible:border-neutral-900 [&_textarea]:focus-visible:ring-1 [&_textarea]:focus-visible:ring-neutral-300/80",
        )}
      >
        <DialogHeader>
          <DialogTitle>Contact {agentName}</DialogTitle>
          <DialogDescription>
            Send a note and let them know what you are looking for.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sender_name">Name</Label>
            <Input
              id="sender_name"
              value={formData.sender_name}
              onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
              placeholder="Your full name"
              maxLength={100}
            />
            {errors.sender_name && <p className="text-sm text-destructive">{errors.sender_name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender_email">Email</Label>
            <Input
              id="sender_email"
              type="email"
              value={formData.sender_email}
              onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
              placeholder="your@email.com"
              maxLength={255}
            />
            {errors.sender_email && <p className="text-sm text-destructive">{errors.sender_email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              
              maxLength={200}
            />
            {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              
              rows={5}
              maxLength={1000}
            />
            {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
            <p className="text-xs text-muted-foreground">{formData.message.length}/1000</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="border-neutral-200" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Sending…" : "Send message"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactAgentProfileDialog;
