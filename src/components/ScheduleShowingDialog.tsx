import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentSenderProfile } from "@/lib/currentSenderProfile";
import { fetchListingPreview } from "@/lib/fetchListingPreview";
import { ListingPreviewCard } from "@/components/share/ListingPreviewCard";
import type { ListingPreview } from "@/components/share/ShareListingsDialog";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type ShowingRequestInsert = Database["public"]["Tables"]["showing_requests"]["Insert"];

const showingRequestSchema = z.object({
  requester_name: z.string().trim().min(1, "Please enter your name").max(100),
  requester_email: z.string().trim().email("Invalid email address").max(255),
  preferred_date: z.string().min(1, "Please select a date"),
  preferred_time: z.string().min(1, "Please select a time"),
  message: z.string().trim().max(1000).optional(),
});

const INPUT_CLASS =
  "border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-visible:!border-neutral-300 focus-visible:ring-1 focus-visible:!ring-neutral-200/70 focus-visible:ring-offset-0";

interface ScheduleShowingDialogProps {
  listingId: string;
  listingAddress: string;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "default" | "outline" | "secondary";
}

const TIME_OPTIONS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00",
];

const ScheduleShowingDialog = ({
  listingId,
  listingAddress,
  triggerLabel = "Schedule Showing",
  triggerClassName,
  triggerVariant = "default",
}: ScheduleShowingDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [listingPreview, setListingPreview] = useState<ListingPreview | undefined>();
  const [formData, setFormData] = useState({
    requester_name: "",
    requester_email: "",
    preferred_date: "",
    preferred_time: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;

    void (async () => {
      const preview = await fetchListingPreview(listingId);
      setListingPreview(preview);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const loggedIn = Boolean(user);
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        const sender = await getCurrentSenderProfile({ source: "auto" });
        setFormData((prev) => ({
          ...prev,
          requester_name: sender?.name ?? "",
          requester_email: sender?.email ?? "",
        }));
      }
    })();
  }, [open, listingId]);

  const resetForm = () => {
    setFormData({
      requester_name: "",
      requester_email: "",
      preferred_date: "",
      preferred_time: "",
      message: "",
    });
    setErrors({});
    setListingPreview(undefined);
    setIsLoggedIn(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    setOpen(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = showingRequestSchema.parse(formData);

      setLoading(true);

      const showingRow: ShowingRequestInsert = {
        listing_id: listingId,
        requester_name: validatedData.requester_name,
        requester_email: validatedData.requester_email,
        requester_phone: null,
        preferred_date: validatedData.preferred_date,
        preferred_time: validatedData.preferred_time,
        message: validatedData.message || null,
      };
      const { error } = await supabase.from("showing_requests").insert([showingRow]);

      if (error) throw error;

      // Authoritative delivery: server resolves listing agent from listingId.
      // Do not treat a client-supplied agentEmail as the destination.
      try {
        const { error: emailError } = await supabase.functions.invoke(
          "send-showing-request-email",
          {
            body: {
              listingId,
              requesterName: validatedData.requester_name,
              requesterEmail: validatedData.requester_email,
              listingAddress,
              preferredDate: validatedData.preferred_date,
              preferredTime: validatedData.preferred_time,
              message: validatedData.message,
              photoUrl: listingPreview?.photoUrl,
            },
          },
        );
        if (emailError) {
          console.error("Failed to send email notification:", emailError);
        }
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
      }

      toast.success("Showing request submitted successfully! The agent will contact you soon.");
      handleOpenChange(false);
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
        toast.error("Failed to submit showing request. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size={triggerClassName ? "default" : "lg"}
          variant={triggerVariant}
          className={cn("gap-2", triggerClassName)}
        >
          <Calendar className={triggerClassName ? "h-4 w-4" : "h-5 w-5"} />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-[0_4px_24px_rgba(0,0,0,0.08)] sm:max-w-xl">
        <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3 sm:px-5">
          <DialogHeader className="space-y-0.5 pr-8">
            <DialogTitle className="text-base font-semibold tracking-tight text-neutral-900 sm:text-[17px]">
              Schedule a Showing
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-snug text-neutral-600">
              Request a showing for {listingAddress}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
            {listingPreview ? <ListingPreviewCard preview={listingPreview} /> : null}

            {!isLoggedIn ? (
              <>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-700">
                    Your name <span className="text-neutral-400">*</span>
                  </div>
                  <Input
                    id="requester_name"
                    value={formData.requester_name}
                    onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                    placeholder="Your full name"
                    maxLength={100}
                    autoComplete="off"
                    className={cn("h-9 rounded-lg text-[13px] text-neutral-900", INPUT_CLASS)}
                  />
                  {errors.requester_name ? (
                    <p className="text-sm text-destructive">{errors.requester_name}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-700">
                    Your email <span className="text-neutral-400">*</span>
                  </div>
                  <Input
                    id="requester_email"
                    type="email"
                    value={formData.requester_email}
                    onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
                    placeholder="your@email.com"
                    maxLength={255}
                    className={cn("h-9 rounded-lg text-[13px] text-neutral-900", INPUT_CLASS)}
                  />
                  {errors.requester_email ? (
                    <p className="text-sm text-destructive">{errors.requester_email}</p>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-neutral-700">
                  Preferred date <span className="text-neutral-400">*</span>
                </div>
                <Input
                  id="preferred_date"
                  type="date"
                  value={formData.preferred_date}
                  onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                  className={cn("h-9 rounded-lg text-[13px] text-neutral-900", INPUT_CLASS)}
                />
                {errors.preferred_date ? (
                  <p className="text-sm text-destructive">{errors.preferred_date}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-neutral-700">
                  Preferred time <span className="text-neutral-400">*</span>
                </div>
                <Select
                  value={formData.preferred_time}
                  onValueChange={(value) => setFormData({ ...formData, preferred_time: value })}
                >
                  <SelectTrigger id="preferred_time" className={cn("h-9 rounded-lg text-[13px]", INPUT_CLASS)}>
                    <SelectValue placeholder="Select a time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {new Date(`1970-01-01T${time}`).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.preferred_time ? (
                  <p className="text-sm text-destructive">{errors.preferred_time}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-700">Additional notes</div>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Any specific requests or questions..."
                rows={3}
                maxLength={1000}
                className={cn("min-h-[84px] resize-y rounded-lg text-[13px] text-neutral-900", INPUT_CLASS)}
              />
              {errors.message ? <p className="text-sm text-destructive">{errors.message}</p> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 bg-white px-4 py-3 sm:px-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm" disabled={loading} className="h-9 rounded-lg text-[13px]">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={loading} className="h-9 rounded-lg text-[13px]">
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleShowingDialog;
