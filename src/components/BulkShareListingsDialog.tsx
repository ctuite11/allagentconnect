import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { ShareListingsDialog, Recipient } from "@/components/share/ShareListingsDialog";
import { useSenderProfilePrefill } from "@/lib/currentSenderProfile";
import { cn } from "@/lib/utils";
import { searchClientContacts } from "@/lib/contactSearch";
import { resolveFirstListingPhotoUrl } from "@/lib/resolveListingPhotoUrl";

interface BulkShareListingsDialogProps {
  listingIds: string[];
  listingCount: number;
  /** `buyer` loads `profiles` for the signed-in buyer; default `agent` uses `agent_profiles`. */
  senderProfileSource?: "agent" | "buyer";
  /** Merged onto the toolbar trigger for density alignment (e.g. agent search results). */
  triggerClassName?: string;
  /** Use `outline` for neutral AAC toolbars (e.g. listing results); default fills primary. */
  triggerVariant?: "default" | "outline";
  /** Called after listings are shared successfully via `send-bulk-listing-share` (selection can clear in parent). */
  onSuccessfulShare?: () => void;
  /** Replaces default `Share Selected (n)` button label when set. */
  triggerLabel?: string;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
}

interface ListingPreview {
  address: string;
  cityStateZip?: string;
  price?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
}

// Recipient type imported from ShareListingsDialog

export function BulkShareListingsDialog({
  listingIds,
  listingCount,
  triggerClassName,
  triggerVariant = "default",
  onSuccessfulShare,
  triggerLabel,
  senderProfileSource = "agent",
}: BulkShareListingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [message, setMessage] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [listingPreview, setListingPreview] = useState<ListingPreview | undefined>();
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  const applySender = useCallback((sender: { name: string; email: string; phone: string }) => {
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
      setAgentName("");
      setMessage("");
      setClientSearch("");
      setClientResults([]);
      setShowClientDropdown(false);
      setShowManualEntry(false);
      setListingPreview(undefined);
      setRecipients([]);
    }
  }, [open, listingIds, senderProfileSource]);

  const handleSaveContact = async (name: string, email: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { error } = await supabase
        .from("clients")
        .insert({
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
  };

  const handleAddRecipient = (recipient: Recipient) => {
    setRecipients(prev => [...prev, recipient]);
  };

  const handleRemoveRecipient = (index: number) => {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  };

  // Search clients
  useEffect(() => {
    const searchClients = async () => {
      if (!clientSearch.trim() || clientSearch.length < 2) {
        setClientResults([]);
        setShowClientDropdown(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const results = await searchClientContacts<Client>({
          agentId: user.id,
          query: clientSearch,
          select: "*",
          limit: 5,
        });
        setClientResults(results);
        setShowClientDropdown(results.length > 0);
      } catch (error) {
        console.error("Error searching clients:", error);
      }
    };

    const debounce = setTimeout(searchClients, 300);
    return () => clearTimeout(debounce);
  }, [clientSearch]);

  const loadListingPreview = async () => {
    if (listingIds.length === 0) return;

    try {
      const { data } = await supabase
        .from("listings")
        .select("address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, photos")
        .eq("id", listingIds[0])
        .single();

      if (data) {
        setListingPreview({
          address: data.address,
          cityStateZip: `${data.city}, ${data.state} ${data.zip_code}`,
          price: data.price ? `$${data.price.toLocaleString()}` : undefined,
          beds: data.bedrooms ?? undefined,
          baths: data.bathrooms ?? undefined,
          sqft: data.square_feet ?? undefined,
          photoUrl: resolveFirstListingPhotoUrl(data.photos),
        });
      }
    } catch (error) {
      console.error("Error loading listing preview:", error);
    }
  };

  const collectRecipients = (): Recipient[] => {
    const all = [...recipients];
    if (recipientEmail.trim() && recipientName.trim()) {
      const email = recipientEmail.trim().toLowerCase();
      if (!all.some((r) => r.email.toLowerCase() === email)) {
        all.push({ name: recipientName.trim(), email: recipientEmail.trim() });
      }
    }
    return all;
  };

  const handleShare = async () => {
    const allRecipients = collectRecipients();
    if (allRecipients.length === 0 || !agentName.trim() || !agentEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      const formattedPhone = agentPhone ? formatPhoneNumber(agentPhone) : "";
      const { trackShare } = await import("@/lib/trackShare");

      for (const recipient of allRecipients) {
        const { error } = await supabase.functions.invoke("send-bulk-listing-share", {
          body: {
            listingIds,
            recipientName: recipient.name,
            recipientEmail: recipient.email,
            agentName,
            agentEmail,
            agentPhone: formattedPhone,
            message,
          },
        });

        if (error) throw error;

        await Promise.all(
          listingIds.map((listingId) => trackShare(listingId, "email_bulk", recipient.email)),
        );
      }

      toast.success(`Successfully shared ${listingCount} listing${listingCount > 1 ? "s" : ""}`);
      setOpen(false);
      onSuccessfulShare?.();
    } catch (error) {
      console.error("Error sharing listings:", error);
      toast.error("Failed to share listings");
    } finally {
      setSending(false);
    }
  };

  // Validation: require sender name + email, recipient email (or at least one recipient), and at least one listing
  const canSubmit = Boolean(
    agentName.trim() && 
    agentEmail.trim() && 
    (recipientEmail.trim() || recipients.length > 0) && 
    listingIds.length > 0
  );

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size="sm"
        className={cn(triggerClassName)}
        disabled={listingCount === 0}
        onClick={() => listingCount > 0 && setOpen(true)}
      >
        <Share2 className="mr-2 h-4 w-4" />
        {triggerLabel ?? `Share Selected (${listingCount})`}
      </Button>

      <ShareListingsDialog
        open={open}
        onOpenChange={setOpen}
        selectedCount={listingCount}
        listingPreview={listingPreview}
        contactQuery={clientSearch}
        setContactQuery={setClientSearch}
        contactResults={clientResults}
        showContactDropdown={showClientDropdown}
        onDismissContactDropdown={() => setShowClientDropdown(false)}
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
        onSaveContact={senderProfileSource === "agent" ? handleSaveContact : undefined}
        recipients={recipients}
        onAddRecipient={handleAddRecipient}
        onRemoveRecipient={handleRemoveRecipient}
      />
    </>
  );
}
