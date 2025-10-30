import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const contactMessageSchema = z.object({
  sender_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  sender_email: z.string().trim().email("Invalid email address").max(255),
  sender_phone: z.string().trim().max(20).optional(),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(1000),
});

interface ContactAgentDialogProps {
  listingId: string;
  agentId: string;
  listingAddress: string;
}

const ContactAgentDialog = ({ listingId, agentId, listingAddress }: ContactAgentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sender_name: "",
    sender_email: "",
    sender_phone: "",
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

      const { error } = await supabase.from("agent_messages").insert([{
        listing_id: listingId,
        agent_id: agentId,
        sender_name: validatedData.sender_name,
        sender_email: validatedData.sender_email,
        sender_phone: validatedData.sender_phone || null,
        message: validatedData.message,
      }] as any);

      if (error) throw error;

      toast.success("Message sent successfully! The agent will get back to you soon.");
      setOpen(false);
      setFormData({
        sender_name: "",
        sender_email: "",
        sender_phone: "",
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
        <Button variant="outline" size="lg" className="gap-2">
          <Mail className="h-5 w-5" />
          Contact Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Contact the Listing Agent</DialogTitle>
          <DialogDescription>
            Send a message about {listingAddress}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sender_name">Name *</Label>
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
            <Label htmlFor="sender_email">Email *</Label>
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
            <Input
              id="sender_phone"
              type="tel"
              value={formData.sender_phone}
              onChange={(e) => setFormData({ ...formData, sender_phone: e.target.value })}
              placeholder="(555) 555-5555"
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="I'm interested in this property and would like more information..."
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

export default ContactAgentDialog;
