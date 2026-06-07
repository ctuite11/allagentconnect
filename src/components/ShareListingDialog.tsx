/**
 * Single Listing Share Dialog
 * Wrapper around the universal ShareListingsDialog for sharing a single listing.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShareListingsDialog, ListingPreview } from "@/components/share/ShareListingsDialog";
import { getCurrentSenderProfile } from "@/lib/currentSenderProfile";
import { fetchListingPreview } from "@/lib/fetchListingPreview";
import { useAgentShareContactSearch } from "@/hooks/useAgentShareContactSearch";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import {
  shareRecipientDisplayName,
  shareRecipientGreetingName,
  type ShareRecipient,
} from "@/lib/shareRecipientUtils";

interface ShareListingDialogProps {
  listingId: string;
  listingAddress: string;
  /** `buyer` loads `profiles`; default `agent` uses `agent_profiles`. */
  senderProfileSource?: "agent" | "buyer";
  /** Controlled mode — omit the built-in trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
    isSearchingContacts,
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
    if (open) {
      void fetchListingPreview(listingId).then(setListingPreview);
    } else {
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
  }, [open, listingId, resetContactSearch]);

  const handleSaveContact =
    senderProfileSource === "agent"
      ? async (recipient: ShareRecipient) => {
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

            if (error) {
              if (error.code === "23505") {
                toast.message(`${shareRecipientDisplayName(recipient)} is already in your contacts`);
                return;
              }
              throw error;
            }
            toast.success(`${shareRecipientDisplayName(recipient)} saved to contacts`);
            await refreshContacts();
          } catch (error) {
            console.error("Error saving contact:", error);
            toast.error(
              error instanceof Error ? error.message : "Failed to save contact",
            );
            throw error;
          }
        }
      : undefined;

  const handleAddRecipient = (recipient: ShareRecipient) => {
    setRecipients([recipient]);
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
        await invokeEdgeFunction("send-listing-share", {
          listingId,
          recipientName: shareRecipientGreetingName(recipient),
          recipientEmail: recipient.email,
          agentName,
          agentEmail,
          message,
        });

        await trackShare(listingId, "email_direct", recipient.email);
      }

      const names = recipients.map((r) => shareRecipientDisplayName(r)).join(", ");
      toast.success(
        recipients.length === 1
          ? `Listing shared with ${names}`
          : `Listing shared with ${recipients.length} contacts`,
      );
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to share listing";
      console.error("Error sharing listing:", error);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const canSubmit = Boolean(
    agentName.trim() &&
    agentEmail.trim() &&
    recipients.length > 0,
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
        contactResults={contactsEnabled ? clientResults : []}
        showContactDropdown={contactsEnabled && showClientDropdown}
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
        onSaveContact={handleSaveContact}
        recipients={recipients}
        onAddRecipient={handleAddRecipient}
        onRemoveRecipient={handleRemoveRecipient}
        lockSenderIdentity={senderLocked}
        maxRecipients={1}
        isSearchingContacts={isSearchingContacts}
      />
    </>
  );
};
