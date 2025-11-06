import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const contactMessageSchema = z.object({
  sender_name: z.string().trim().min(1, "Please enter your name").max(100),
  sender_email: z.string().trim().email("Invalid email address").max(255),
  sender_phone: z.string().trim().max(20).optional(),
  message: z.string().trim().max(1000).optional(),
  subject: z.string().trim().min(1, "Please enter a subject").max(200),
});

interface ContactAgentProfileDialogProps {
  agentId: string;
  agentName: string;
  agentEmail: string;
}

const ContactAgentProfileDialog = ({ agentId, agentName, agentEmail }: ContactAgentProfileDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sender_name: "",
    sender_email: "",
    sender_phone: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validate form data
      const validatedData = contactMessageSchema.parse(formData);
      
      setLoading(true);

      // Send email notification to agent
      try {
        await supabase.functions.invoke("send-agent-profile-contact", {
          body: {
            agentEmail: agentEmail,
            agentName: agentName,
            senderName: validatedData.sender_name,
            senderEmail: validatedData.sender_email,
            senderPhone: validatedData.sender_phone,
            message: validatedData.message,
            subject: validatedData.subject,
          },
        });
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        toast.error("Failed to send message. Please try again.");
        return;
      }

      toast.success("Message sent successfully! The agent will get back to you soon.");
      setOpen(false);
      setFormData({
        sender_name: "",
        sender_email: "",
        sender_phone: "",
        subject: "",
        message: "",
      });
    } catch (error: any) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2">
          <Mail className="h-4 w-4" />
          Contact Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Contact {agentName}</DialogTitle>
          <DialogDescription>
            Send a message to this agent about their services
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
            <Label htmlFor="sender_phone">Phone</Label>
            <FormattedInput
              id="sender_phone"
              format="phone"
              value={formData.sender_phone}
              onChange={(value) => setFormData({ ...formData, sender_phone: value })}
              placeholder="(555) 555-5555"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="What's this about?"
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
              placeholder="I'm interested in working with you..."
              rows={5}
              maxLength={1000}
            />
            {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
            <p className="text-xs text-muted-foreground">{formData.message.length}/1000</p>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactAgentProfileDialog;
