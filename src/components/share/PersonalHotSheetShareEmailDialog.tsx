import { useEffect, useState } from "react";
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
} from "@/components/share/ShareListingsDialog";
import { getCurrentSenderProfile } from "@/lib/currentSenderProfile";
import { useAgentShareContactSearch } from "@/hooks/useAgentShareContactSearch";
import {
  shareRecipientDisplayName,
  shareRecipientGreetingName,
  type ShareRecipient,
} from "@/lib/shareRecipientUtils";

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
  const [recipientFirstName, setRecipientFirstName] = useState("");
  const [recipientLastName, setRecipientLastName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentFirstName, setAgentFirstName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [message, setMessage] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [recipients, setRecipients] = useState<ShareRecipient[]>([]);
  const [senderLocked, setSenderLocked] = useState(false);
  const {
    contactQuery: clientSearch,
    setContactQuery: setClientSearch,
    contactResults: clientResults,
    showContactDropdown: showClientDropdown,
    dismissContactDropdown,
    handleContactSearchFocus,
    resetContactSearch,
    refreshContacts,
    isSearchingContacts,
  } = useAgentShareContactSearch(open, true);

  useEffect(() => {
    if (!open) return;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const loggedIn = Boolean(user);
      setSenderLocked(loggedIn);

      if (loggedIn) {
        const sender = await getCurrentSenderProfile({ source: "agent" });
        if (sender) {
          setAgentFirstName(sender.firstName);
          setAgentName(sender.name);
          setAgentEmail(sender.email);
        }
      } else {
        setAgentFirstName("");
        setAgentName("");
        setAgentEmail("");
      }
    })();
  }, [open]);

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
      setRecipientFirstName("");
      setRecipientLastName("");
      setRecipientEmail("");
      setAgentName("");
      setAgentFirstName("");
      setAgentEmail("");
      setMessage("");
      resetContactSearch();
      setShowManualEntry(false);
      setRecipients([]);
    }
  }, [open, resetContactSearch]);

  const handleSaveContact = async (recipient: ShareRecipient) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("clients").insert({
        agent_id: user.id,
        first_name: recipient.firstName,
        last_name: recipient.lastName ?? "",
        email: recipient.email.trim(),
      });

      if (error) throw error;
      toast.success(`${shareRecipientDisplayName(recipient)} saved to contacts`);
      await refreshContacts();
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error("Failed to save contact");
      throw error;
    }
  };

  const handleShare = async () => {
    if (selectedListingIds.length === 0) {
      toast.error("Select at least one listing to share");
      return;
    }

    if (recipients.length === 0 || !agentName.trim() || !agentEmail.trim()) {
      toast.error("Please add at least one recipient");
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
        recipients: recipients.map((recipient) => ({
          email: recipient.email,
          name: shareRecipientGreetingName(recipient),
        })),
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

      const names = recipients.map((r) => shareRecipientDisplayName(r)).join(", ");
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
      recipients.length > 0,
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
        onDismissContactDropdown={dismissContactDropdown}
        onContactSearchFocus={handleContactSearchFocus}
        manualMode={showManualEntry}
        setManualMode={setShowManualEntry}
        recipientFirstName={recipientFirstName}
        setRecipientFirstName={setRecipientFirstName}
        recipientLastName={recipientLastName}
        setRecipientLastName={setRecipientLastName}
        recipientEmail={recipientEmail}
        setRecipientEmail={setRecipientEmail}
        senderName={agentName}
        setSenderName={setAgentName}
        senderEmail={agentEmail}
        setSenderEmail={setAgentEmail}
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
        lockSenderIdentity={senderLocked}
        isSearchingContacts={isSearchingContacts}
      />
  );
}
