import { useState, useEffect } from "react";
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
  buttonText?: string;
  listingId?: string;
  buyerNeedId?: string;
}

const ContactAgentProfileDialog = ({ 
  agentId, 
  agentName, 
  agentEmail, 
  buttonText = "Contact Agent",
  listingId,
  buyerNeedId,
}: ContactAgentProfileDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    sender_name: "",
    sender_email: "",
    sender_phone: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if current user is an authenticated agent
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, email, phone")
          .eq("id", user.id)
          .maybeSingle();
        
        if (profile) {
          setCurrentUser({ ...user, profile });
          // Pre-fill form with agent's info
          setFormData(prev => ({
            ...prev,
            sender_name: `${profile.first_name} ${profile.last_name}`,
            sender_email: profile.email,
            sender_phone: profile.phone || "",
          }));
        }
      }
    };
    if (open) {
      checkUser();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validate form data
      const validatedData = contactMessageSchema.parse(formData);
      
      setLoading(true);

      // If sender is an authenticated agent, create/update conversation
      if (currentUser?.profile) {
        const senderId = currentUser.id;
        const recipientId = agentId;

        // Normalize agent IDs for consistent lookup (smaller ID first)
        const [agentAId, agentBId] = [senderId, recipientId].sort();

        // Look for existing conversation with same context
        let conversationId: string | null = null;
        
        const query = supabase
          .from("conversations")
          .select("id")
          .eq("agent_a_id", agentAId)
          .eq("agent_b_id", agentBId);
        
        if (listingId) {
          query.eq("listing_id", listingId);
        } else {
          query.is("listing_id", null);
        }
        
        if (buyerNeedId) {
          query.eq("buyer_need_id", buyerNeedId);
        } else {
          query.is("buyer_need_id", null);
        }

        const { data: existingConvo } = await query.maybeSingle();

        if (existingConvo) {
          conversationId = existingConvo.id;
        } else {
          // Create new conversation
          const { data: newConvo, error: convoError } = await supabase
            .from("conversations")
            .insert({
              agent_a_id: agentAId,
              agent_b_id: agentBId,
              listing_id: listingId || null,
              buyer_need_id: buyerNeedId || null,
            })
            .select("id")
            .single();

          if (convoError) throw convoError;
          conversationId = newConvo.id;
        }

        // Insert message into conversation_messages
        const { error: msgError } = await supabase
          .from("conversation_messages")
          .insert({
            conversation_id: conversationId,
            sender_agent_id: senderId,
            recipient_agent_id: recipientId,
            subject: validatedData.subject,
            body: validatedData.message || "",
          });

        if (msgError) throw msgError;
      }

      // Also send email notification to agent
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
        // Don't fail the whole operation if email fails
      }

      toast.success("Message sent successfully! The agent will get back to you soon.");
      setOpen(false);
      setFormData({
        sender_name: currentUser?.profile ? `${currentUser.profile.first_name} ${currentUser.profile.last_name}` : "",
        sender_email: currentUser?.profile?.email || "",
        sender_phone: currentUser?.profile?.phone || "",
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
        console.error("Error sending message:", error);
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
          {buttonText}
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
              disabled={!!currentUser?.profile}
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
              disabled={!!currentUser?.profile}
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
              placeholder="1234567890"
              disabled={!!currentUser?.profile}
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
