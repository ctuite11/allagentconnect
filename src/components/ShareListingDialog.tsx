/**
 * Single Listing Share Dialog
 * Wrapper around the universal ShareListingsDialog for sharing a single listing.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { ShareListingsDialog, Recipient, ListingPreview } from "@/components/share/ShareListingsDialog";
import { useSenderProfilePrefill } from "@/lib/currentSenderProfile";

interface ShareListingDialogProps {
  listingId: string;
  listingAddress: string;
  /** `buyer` loads `profiles`; default `agent` uses `agent_profiles`. */
  senderProfileSource?: "agent" | "buyer";
  /** Controlled mode — omit the built-in trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
}

export const ShareListingDialog = ({
  listingId,
  listingAddress: _listingAddress,
  senderProfileSource = "agent",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ShareListingDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;
  const [sending, setSending] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [message, setMessage] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [listingPreview, setListingPreview] = useState<ListingPreview | undefined>();
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  const applySender = useCallback((sender: { name: string; email: string; phone: string }) => {
    setAgentName(sender.name);
    setAgentEmail(sender.email);
    setAgentPhone(sender.phone);
  }, []);

  useSenderProfilePrefill(
    open,
    applySender,
    senderProfileSource === "buyer" ? "buyer" : "agent",
  );

  useEffect(() => {
    if (open) {
      loadListingPreview();
    } else {
      // Reset form when closing
      setRecipientName("");
      setRecipientEmail("");
      setMessage("");
      setClientSearch("");
      setShowManualEntry(false);
      setListingPreview(undefined);
      setRecipients([]);
    }
  }, [open, listingId]);

  const loadListingPreview = async () => {
    try {
      const { data } = await supabase
        .from("listings")
        .select("address, city, state, zip_code, price, bedrooms, bathrooms, square_feet")
        .eq("id", listingId)
        .single();

      if (data) {
        setListingPreview({
          address: data.address,
          cityStateZip: `${data.city}, ${data.state} ${data.zip_code}`,
          price: data.price ? `$${data.price.toLocaleString()}` : undefined,
          beds: data.bedrooms ?? undefined,
          baths: data.bathrooms ?? undefined,
          sqft: data.square_feet ?? undefined,
        });
      }
    } catch (error) {
      console.error("Error loading listing preview:", error);
    }
  };

  const handleSaveContact =
    senderProfileSource === "agent"
      ? async (name: string, email: string) => {
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const nameParts = name.trim().split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            const { error } = await supabase.from("clients").insert({
              agent_id: user.id,
              first_name: firstName,
              last_name: lastName,
              email: email.trim(),
            });

            if (error) throw error;
            toast.success(`${name} saved to contacts`);
          } catch (error) {
            console.error("Error saving contact:", error);
            toast.error("Failed to save contact");
          }
        }
      : undefined;

  const handleAddRecipient = (recipient: Recipient) => {
    setRecipients(prev => [...prev, recipient]);
  };

  const handleRemoveRecipient = (index: number) => {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  };

  const handleShare = async () => {
    if (!recipientName || !recipientEmail || !agentName || !agentEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      const formattedPhone = agentPhone ? formatPhoneNumber(agentPhone) : "";
      
      const { error } = await supabase.functions.invoke('send-listing-share', {
        body: {
          listingId,
          recipientName,
          recipientEmail,
          agentName,
          agentEmail,
          agentPhone: formattedPhone,
          message
        }
      });

      if (error) throw error;

      // Track the share
      const { trackShare } = await import("@/lib/trackShare");
      await trackShare(listingId, 'email_direct', recipientEmail);

      toast.success(`Listing shared with ${recipientName}`);
      setOpen(false);
    } catch (error) {
      console.error('Error sharing listing:', error);
      toast.error("Failed to share listing");
    } finally {
      setSending(false);
    }
  };

  const canSubmit = Boolean(
    agentName.trim() && 
    agentEmail.trim() && 
    (recipientEmail.trim() || recipients.length > 0)
  );

  return (
    <>
      {!isControlled ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Share2 className="w-4 h-4 mr-2" />
          Share Listing
        </Button>
      ) : null}

      <ShareListingsDialog
        open={open}
        onOpenChange={setOpen}
        selectedCount={1}
        listingPreview={listingPreview}
        contactQuery={clientSearch}
        setContactQuery={setClientSearch}
        manualMode={showManualEntry}
        setManualMode={setShowManualEntry}
        recipientName={recipientName}
        setRecipientName={setRecipientName}
        recipientEmail={recipientEmail}
        setRecipientEmail={setRecipientEmail}
        senderName={agentName}
        setSenderName={setAgentName}
        senderEmail={agentEmail}
        setSenderEmail={setAgentEmail}
        senderPhone={agentPhone}
        setSenderPhone={setAgentPhone}
        message={message}
        setMessage={setMessage}
        canSubmit={canSubmit}
        submitting={sending}
        onSubmit={handleShare}
        onSaveContact={handleSaveContact}
        recipients={recipients}
        onAddRecipient={handleAddRecipient}
        onRemoveRecipient={handleRemoveRecipient}
      />
    </>
  );
};
