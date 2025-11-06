import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Calendar } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

      // Fetch agent and listing details to send email
      const { data: listingData } = await supabase
        .from("listings")
        .select("agent_id, address, city, state, agent_profiles!inner(email, first_name, last_name)")
        .eq("id", listingId)
        .single();

      if (listingData) {
        const agentProfile = (listingData as any).agent_profiles;
        const fullAddress = `${listingData.address}, ${listingData.city}, ${listingData.state}`;
        
        // Send email notification to agent
        try {
          await supabase.functions.invoke("send-showing-request-email", {
            body: {
              agentEmail: agentProfile.email,
              agentName: `${agentProfile.first_name} ${agentProfile.last_name}`,
              requesterName: validatedData.requester_name,
              requesterEmail: validatedData.requester_email,
              requesterPhone: validatedData.requester_phone,
              listingAddress: fullAddress,
              preferredDate: validatedData.preferred_date,
              preferredTime: validatedData.preferred_time,
              message: validatedData.message,
            },
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
          // Don't block the user experience if email fails
        }
      }

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
              <Select
                value={formData.preferred_time}
                onValueChange={(value) => setFormData({ ...formData, preferred_time: value })}
              >
                <SelectTrigger id="preferred_time">
                  <SelectValue placeholder="Select a time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="08:00">8:00 AM</SelectItem>
                  <SelectItem value="08:30">8:30 AM</SelectItem>
                  <SelectItem value="09:00">9:00 AM</SelectItem>
                  <SelectItem value="09:30">9:30 AM</SelectItem>
                  <SelectItem value="10:00">10:00 AM</SelectItem>
                  <SelectItem value="10:30">10:30 AM</SelectItem>
                  <SelectItem value="11:00">11:00 AM</SelectItem>
                  <SelectItem value="11:30">11:30 AM</SelectItem>
                  <SelectItem value="12:00">12:00 PM</SelectItem>
                  <SelectItem value="12:30">12:30 PM</SelectItem>
                  <SelectItem value="13:00">1:00 PM</SelectItem>
                  <SelectItem value="13:30">1:30 PM</SelectItem>
                  <SelectItem value="14:00">2:00 PM</SelectItem>
                  <SelectItem value="14:30">2:30 PM</SelectItem>
                  <SelectItem value="15:00">3:00 PM</SelectItem>
                  <SelectItem value="15:30">3:30 PM</SelectItem>
                  <SelectItem value="16:00">4:00 PM</SelectItem>
                  <SelectItem value="16:30">4:30 PM</SelectItem>
                  <SelectItem value="17:00">5:00 PM</SelectItem>
                  <SelectItem value="17:30">5:30 PM</SelectItem>
                  <SelectItem value="18:00">6:00 PM</SelectItem>
                  <SelectItem value="18:30">6:30 PM</SelectItem>
                  <SelectItem value="19:00">7:00 PM</SelectItem>
                </SelectContent>
              </Select>
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
