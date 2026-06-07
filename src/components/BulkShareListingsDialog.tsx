import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShareListingsDialog, type ListingPreview } from "@/components/share/ShareListingsDialog";
import { getCurrentSenderProfile } from "@/lib/currentSenderProfile";
import { fetchListingPreview } from "@/lib/fetchListingPreview";
import { cn } from "@/lib/utils";
import { useAgentShareContactSearch } from "@/hooks/useAgentShareContactSearch";
import {
  shareRecipientDisplayName,
  shareRecipientGreetingName,
  type ShareRecipient,
} from "@/lib/shareRecipientUtils";

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
  const [recipientFirstName, setRecipientFirstName] = useState("");
  const [recipientLastName, setRecipientLastName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [message, setMessage] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [listingPreview, setListingPreview] = useState<ListingPreview | undefined>();
  const [recipients, setRecipients] = useState<ShareRecipient[]>([]);
  const [senderLocked, setSenderLocked] = useState(false);
  const contactsEnabled = senderProfileSource === "agent";
  const {
    contactQuery: clientSearch,
    setContactQuery: setClientSearch,
    contactResults: clientResults,
    showContactDropdown: showClientDropdown,
    dismissContactDropdown,
    handleContactSearchFocus,
    resetContactSearch,
    refreshContacts,
  } = useAgentShareContactSearch(open, contactsEnabled);

  useEffect(() => {
    if (!open) return;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const loggedIn = Boolean(user);
      setSenderLocked(loggedIn);

      if (loggedIn) {
        const sender = await getCurrentSenderProfile({
          source: senderProfileSource === "buyer" ? "buyer" : "auto",
        });
        if (sender) {
          setAgentName(sender.name);
          setAgentEmail(sender.email);
        }
      } else {
        setAgentName("");
        setAgentEmail("");
      }
    })();
  }, [open, senderProfileSource]);

  useEffect(() => {
    if (open && listingIds[0]) {
      void fetchListingPreview(listingIds[0]).then(setListingPreview);
    } else if (!open) {
      // Reset form when closing
      setRecipientFirstName("");
      setRecipientLastName("");
      setRecipientEmail("");
      setAgentName("");
      setAgentEmail("");
      setMessage("");
      resetContactSearch();
      setShowManualEntry(false);
      setListingPreview(undefined);
      setRecipients([]);
    }
  }, [open, listingIds, resetContactSearch]);

  const handleSaveContact = async (recipient: ShareRecipient) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("clients")
        .insert({
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

  const handleAddRecipient = (recipient: ShareRecipient) => {
    setRecipients(prev => [...prev, recipient]);
  };

  const handleRemoveRecipient = (index: number) => {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  };

  const handleShare = async () => {
    if (recipients.length === 0 || !agentName.trim() || !agentEmail.trim()) {
      toast.error("Please add at least one recipient");
      return;
    }

    setSending(true);
    try {
      const { trackShare } = await import("@/lib/trackShare");

      for (const recipient of recipients) {
        const { error } = await supabase.functions.invoke("send-bulk-listing-share", {
          body: {
            listingIds,
            recipientName: shareRecipientGreetingName(recipient),
            recipientEmail: recipient.email,
            agentName,
            agentEmail,
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

  const canSubmit = Boolean(
    agentName.trim() &&
    agentEmail.trim() &&
    recipients.length > 0 &&
    listingIds.length > 0,
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
        onSubmit={handleShare}
        onSaveContact={senderProfileSource === "agent" ? handleSaveContact : undefined}
        recipients={recipients}
        onAddRecipient={handleAddRecipient}
        onRemoveRecipient={handleRemoveRecipient}
        lockSenderIdentity={senderLocked}
      />
    </>
  );
}
