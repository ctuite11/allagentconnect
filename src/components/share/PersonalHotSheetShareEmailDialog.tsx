import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import {
  buildHotSheetShareEmailHtml,
  buildPersonalListingShareEmailSubject,
  type ListingShareEmailListing,
} from "@/lib/buildHotSheetShareEmailHtml";
import {
  ShareListingsDialog,
  type ContactSearchResult,
  type ListingPreview,
  type Recipient,
} from "@/components/share/ShareListingsDialog";
import { useSenderProfilePrefill } from "@/lib/currentSenderProfile";

const HOT_SHEET_MESSAGE_CHIPS = [
  "Here are listings that match your search criteria.",
  "Let me know which properties you'd like to tour.",
  "Happy to adjust filters if needed.",
];

type Client = ContactSearchResult;

export type PersonalHotSheetShareListingPreview = ListingShareEmailListing;

type PersonalHotSheetShareEmailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotSheetId: string;
  title: string;
  description?: string;
  selectedListingIds: string[];
  selectedListingPreviews?: PersonalHotSheetShareListingPreview[];
};

export function PersonalHotSheetShareEmailDialog({
  open,
  onOpenChange,
  hotSheetId,
  title,
  description = "",
  selectedListingIds,
  selectedListingPreviews = [],
}: PersonalHotSheetShareEmailDialogProps) {
  const [sending, setSending] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentFirstName, setAgentFirstName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [message, setMessage] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  const applySender = useCallback((sender: { name: string; firstName: string; email: string; phone: string }) => {
    setAgentFirstName(sender.firstName);
    setAgentName(sender.name);
    setAgentEmail(sender.email);
    setAgentPhone(sender.phone);
  }, []);

  useSenderProfilePrefill(open, applySender, "agent");

  const selectedCount = selectedListingIds.length;
  const singleListingPreview =
    selectedCount === 1 ? selectedListingPreviews[0] : undefined;
  const toDialogPreview = (listing: ListingShareEmailListing): ListingPreview => ({
    address: listing.address,
    cityStateZip: `${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`
      .trim()
      .replace(/^,\s*|,\s*$/g, ""),
    price: listing.price != null && listing.price > 0 ? `$${listing.price.toLocaleString()}` : undefined,
    beds: listing.bedrooms ?? undefined,
    baths: listing.bathrooms ?? undefined,
    sqft: listing.square_feet ?? undefined,
  });

  const listingPreview: ListingPreview | undefined =
    selectedCount === 1 && singleListingPreview ? toDialogPreview(singleListingPreview) : undefined;
  const shareDescription =
    selectedCount === 1
      ? "Send this selected listing to a contact via email."
      : `Send ${selectedCount} selected listings to a contact via email.`;
  const previewVariant = selectedCount === 1 && singleListingPreview ? "listing" : "listing";

  useEffect(() => {
    if (!open) {
      setRecipientName("");
      setRecipientEmail("");
      setMessage("");
      setClientSearch("");
      setClientResults([]);
      setShowClientDropdown(false);
      setShowManualEntry(false);
      setRecipients([]);
    }
  }, [open]);

  useEffect(() => {
    const searchClients = async () => {
      if (!clientSearch.trim() || clientSearch.length < 2) {
        setClientResults([]);
        setShowClientDropdown(false);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("agent_id", user.id)
          .or(
            `first_name.ilike.%${clientSearch}%,last_name.ilike.%${clientSearch}%,email.ilike.%${clientSearch}%`,
          )
          .order("first_name")
          .limit(5);

        if (error) throw error;
        const results = data || [];
        setClientResults(results);
        setShowClientDropdown(results.length > 0);
      } catch (error) {
        console.error("Error searching clients:", error);
      }
    };

    const debounce = setTimeout(searchClients, 300);
    return () => clearTimeout(debounce);
  }, [clientSearch]);

  const handleSaveContact = async (name: string, email: string) => {
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
    if (selectedListingIds.length === 0) {
      toast.error("Select at least one listing to share");
      return;
    }

    const allRecipients = collectRecipients();
    if (allRecipients.length === 0 || !agentName.trim() || !agentEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired. Please sign in again.");

      const listingsForEmail = selectedListingIds
        .map((listingId) => selectedListingPreviews.find((listing) => listing.id === listingId))
        .filter((listing): listing is ListingShareEmailListing => Boolean(listing));

      const composedMessageHtml = buildHotSheetShareEmailHtml({
        userMessage: message,
        listings: listingsForEmail,
        agentFirstName: agentFirstName || agentName,
      });

      await invokeEdgeFunction("send-bulk-email", {
        recipients: allRecipients,
        subject: buildPersonalListingShareEmailSubject(
          agentFirstName || agentName,
          selectedCount,
          selectedCount === 1 ? listingsForEmail[0] : null,
        ),
        message: composedMessageHtml,
        agentId: user.id,
        agentEmail: agentEmail.trim(),
        sendAsGroup: false,
      });

      const names = allRecipients.map((r) => r.name).join(", ");
      toast.success(`Hot sheet shared with ${names}`);
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Error sharing hot sheet:", error);
      const messageText = error instanceof Error ? error.message : "Failed to share listing(s)";
      toast.error(messageText);
    } finally {
      setSending(false);
    }
  };

  const canSubmit = Boolean(
    selectedListingIds.length > 0 &&
      agentName.trim() &&
      agentEmail.trim() &&
      (recipientEmail.trim() || recipients.length > 0),
  );

  return (
    <ShareListingsDialog
        open={open}
        onOpenChange={onOpenChange}
        selectedCount={Math.max(selectedCount, 1)}
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
        onSubmit={() => void handleShare()}
        onSaveContact={handleSaveContact}
        recipients={recipients}
        onAddRecipient={(recipient) => setRecipients((prev) => [...prev, recipient])}
        onRemoveRecipient={(index) => setRecipients((prev) => prev.filter((_, i) => i !== index))}
        shareTitle="Share Hot Sheet"
        shareDescription={shareDescription}
        messageChips={HOT_SHEET_MESSAGE_CHIPS}
        previewVariant={previewVariant}
        submitButtonLabel="Send email"
      />
  );
}
