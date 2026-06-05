/**
 * Single Listing Share Dialog
 * Wrapper around the universal ShareListingsDialog for sharing a single listing.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShareListingsDialog, Recipient, ListingPreview } from "@/components/share/ShareListingsDialog";
import { getCurrentSenderProfile } from "@/lib/currentSenderProfile";
import { fetchListingPreview } from "@/lib/fetchListingPreview";
import { searchClientContacts } from "@/lib/contactSearch";

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
  const [message, setMessage] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [listingPreview, setListingPreview] = useState<ListingPreview | undefined>();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [senderLocked, setSenderLocked] = useState(false);

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
      setRecipientName("");
      setRecipientEmail("");
      setAgentName("");
      setAgentEmail("");
      setMessage("");
      setClientSearch("");
      setClientResults([]);
      setShowClientDropdown(false);
      setShowManualEntry(false);
      setListingPreview(undefined);
      setRecipients([]);
    }
  }, [open, listingId]);

  useEffect(() => {
    if (!open || senderProfileSource !== "agent") {
      setClientResults([]);
      setShowClientDropdown(false);
      return;
    }

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
  }, [clientSearch, open, senderProfileSource]);

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
      const { trackShare } = await import("@/lib/trackShare");

      for (const recipient of allRecipients) {
        const { error } = await supabase.functions.invoke("send-listing-share", {
          body: {
            listingId,
            recipientName: recipient.name,
            recipientEmail: recipient.email,
            agentName,
            agentEmail,
            message,
          },
        });

        if (error) throw error;
        await trackShare(listingId, "email_direct", recipient.email);
      }

      const names = allRecipients.map((r) => r.name).join(", ");
      toast.success(
        allRecipients.length === 1
          ? `Listing shared with ${names}`
          : `Listing shared with ${allRecipients.length} contacts`,
      );
      setOpen(false);
    } catch (error) {
      console.error("Error sharing listing:", error);
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
        contactResults={senderProfileSource === "agent" ? clientResults : []}
        showContactDropdown={senderProfileSource === "agent" && showClientDropdown}
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
      />
    </>
  );
};
