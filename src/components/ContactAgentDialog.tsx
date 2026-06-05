import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { getCurrentSenderProfile } from "@/lib/currentSenderProfile";
import { fetchListingPreview } from "@/lib/fetchListingPreview";
import { ListingPreviewCard } from "@/components/share/ListingPreviewCard";
import type { ListingPreview } from "@/components/share/ShareListingsDialog";
import { cn } from "@/lib/utils";

const contactMessageSchema = z.object({
  sender_name: z.string().trim().min(1, "Please enter your name").max(100),
  sender_email: z.string().trim().email("Invalid email address").max(255),
  sender_phone: z.string().trim().max(20).optional(),
  message: z.string().trim().max(1000).optional(),
});

const INPUT_CLASS =
  "border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-visible:!border-neutral-300 focus-visible:ring-1 focus-visible:!ring-neutral-200/70 focus-visible:ring-offset-0";

interface ContactAgentDialogProps {
  listingId: string;
  agentId: string;
  listingAddress: string;
  buttonSize?: "sm" | "default" | "lg";
  buttonVariant?: "default" | "outline" | "secondary";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

const ContactAgentDialog = ({
  listingId,
  agentId,
  listingAddress,
  buttonSize = "lg",
  buttonVariant = "outline",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: ContactAgentDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [listingPreview, setListingPreview] = useState<ListingPreview | undefined>();
  const [formData, setFormData] = useState({
    sender_name: "",
    sender_email: "",
    sender_phone: "",
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
          sender_name: sender?.name ?? "",
          sender_email: sender?.email ?? "",
          sender_phone: sender?.phone ?? prev.sender_phone,
        }));
      }
    })();
  }, [open, listingId]);

  const resetForm = () => {
    setFormData({
      sender_name: "",
      sender_email: "",
      sender_phone: "",
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

      const { data: agentData, error: agentError } = await supabase
        .from("agent_profiles")
        .select("email, first_name, last_name")
        .eq("id", agentId)
        .single();

      if (!agentError && agentData) {
        try {
          await supabase.functions.invoke("send-contact-email", {
            body: {
              agentEmail: agentData.email,
              agentName: `${agentData.first_name} ${agentData.last_name}`,
              senderName: validatedData.sender_name,
              senderEmail: validatedData.sender_email,
              senderPhone: validatedData.sender_phone,
              message: validatedData.message,
              listingAddress: listingAddress,
            },
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
        }
      }

      toast.success("Message sent successfully! The agent will get back to you soon.");
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
        toast.error("Failed to send message. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant={buttonVariant}
            size={buttonSize}
            className="gap-1.5 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className={buttonSize === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} />
            Contact
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-[0_4px_24px_rgba(0,0,0,0.08)] sm:max-w-xl">
        <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3 sm:px-5">
          <DialogHeader className="space-y-0.5 pr-8">
            <DialogTitle className="text-base font-semibold tracking-tight text-neutral-900 sm:text-[17px]">
              Listing Inquiry
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-snug text-neutral-600">
              Send a message about {listingAddress}
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
                    id="sender_name"
                    value={formData.sender_name}
                    onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                    placeholder="Your full name"
                    maxLength={100}
                    autoComplete="off"
                    className={cn("h-9 rounded-lg text-[13px] text-neutral-900", INPUT_CLASS)}
                  />
                  {errors.sender_name ? (
                    <p className="text-sm text-destructive">{errors.sender_name}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-700">
                    Your email <span className="text-neutral-400">*</span>
                  </div>
                  <Input
                    id="sender_email"
                    type="email"
                    value={formData.sender_email}
                    onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
                    placeholder="your@email.com"
                    maxLength={255}
                    className={cn("h-9 rounded-lg text-[13px] text-neutral-900", INPUT_CLASS)}
                  />
                  {errors.sender_email ? (
                    <p className="text-sm text-destructive">{errors.sender_email}</p>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-700">Phone</div>
              <FormattedInput
                id="sender_phone"
                format="phone"
                value={formData.sender_phone}
                onChange={(value) => setFormData({ ...formData, sender_phone: value })}
                placeholder="1234567890"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-700">Message</div>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="I'm interested in this property and would like more information..."
                rows={5}
                maxLength={1000}
                className={cn("min-h-[84px] resize-y rounded-lg text-[13px] text-neutral-900", INPUT_CLASS)}
              />
              {errors.message ? <p className="text-sm text-destructive">{errors.message}</p> : null}
              <p className="text-xs text-muted-foreground">{formData.message.length}/1000</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 bg-white px-4 py-3 sm:px-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm" disabled={loading} className="h-9 rounded-lg text-[13px]">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={loading} className="h-9 rounded-lg text-[13px]">
              {loading ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactAgentDialog;
