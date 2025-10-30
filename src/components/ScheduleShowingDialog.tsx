import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const showingRequestSchema = z.object({
  requester_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  requester_email: z.string().trim().email("Invalid email address").max(255),
  requester_phone: z.string().trim().max(20).optional(),
  preferred_date: z.string().min(1, "Please select a date"),
  preferred_time: z.string().min(1, "Please select a time"),
  message: z.string().trim().max(1000).optional(),
});

interface ScheduleShowingDialogProps {
  listingId: string;
  listingAddress: string;
}

const ScheduleShowingDialog = ({ listingId, listingAddress }: ScheduleShowingDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    requester_name: "",
    requester_email: "",
    requester_phone: "",
    preferred_date: "",
    preferred_time: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validate form data
      const validatedData = showingRequestSchema.parse(formData);
      
      setLoading(true);

      const { error } = await supabase.from("showing_requests").insert([{
        listing_id: listingId,
        requester_name: validatedData.requester_name,
        requester_email: validatedData.requester_email,
        requester_phone: validatedData.requester_phone || null,
        preferred_date: validatedData.preferred_date,
        preferred_time: validatedData.preferred_time,
        message: validatedData.message || null,
      }] as any);

      if (error) throw error;

      toast.success("Showing request submitted successfully! The agent will contact you soon.");
      setOpen(false);
      setFormData({
        requester_name: "",
        requester_email: "",
        requester_phone: "",
        preferred_date: "",
        preferred_time: "",
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
        toast.error("Failed to submit showing request. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Calendar className="h-5 w-5" />
          Schedule Showing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule a Showing</DialogTitle>
          <DialogDescription>
            Request to schedule a showing for {listingAddress}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="requester_name">Name *</Label>
            <Input
              id="requester_name"
              value={formData.requester_name}
              onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
              placeholder="Your full name"
              maxLength={100}
            />
            {errors.requester_name && <p className="text-sm text-destructive">{errors.requester_name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="requester_email">Email *</Label>
            <Input
              id="requester_email"
              type="email"
              value={formData.requester_email}
              onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
              placeholder="your@email.com"
              maxLength={255}
            />
            {errors.requester_email && <p className="text-sm text-destructive">{errors.requester_email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="requester_phone">Phone</Label>
            <Input
              id="requester_phone"
              type="tel"
              value={formData.requester_phone}
              onChange={(e) => setFormData({ ...formData, requester_phone: e.target.value })}
              placeholder="(555) 555-5555"
              maxLength={20}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preferred_date">Preferred Date *</Label>
              <Input
                id="preferred_date"
                type="date"
                value={formData.preferred_date}
                onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
              {errors.preferred_date && <p className="text-sm text-destructive">{errors.preferred_date}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_time">Preferred Time *</Label>
              <Input
                id="preferred_time"
                type="time"
                value={formData.preferred_time}
                onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
              />
              {errors.preferred_time && <p className="text-sm text-destructive">{errors.preferred_time}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Additional Notes</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Any specific requests or questions..."
              rows={3}
              maxLength={1000}
            />
            {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleShowingDialog;
