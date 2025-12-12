import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { ShareListingsDialog } from "@/components/listings/ShareListingsDialog";

interface BulkShareListingsDialogProps {
  listingIds: string[];
  listingCount: number;
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

export function BulkShareListingsDialog({ listingIds, listingCount }: BulkShareListingsDialogProps) {
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
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadAgentProfile();
      loadListingPreview();
    } else {
      // Reset form when closing
      setRecipientName("");
      setRecipientEmail("");
      setMessage("");
      setClientSearch("");
      setClientResults([]);
      setShowClientDropdown(false);
      setShowManualEntry(false);
      setListingPreview(undefined);
    }
  }, [open, listingIds]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("agent_id", user.id)
          .or(`first_name.ilike.%${clientSearch}%,last_name.ilike.%${clientSearch}%,email.ilike.%${clientSearch}%`)
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

  const loadAgentProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name, email, phone, cell_phone")
        .eq("id", user.id)
        .single();

      if (profile) {
        setAgentName(`${profile.first_name} ${profile.last_name}`);
        setAgentEmail(profile.email);
        setAgentPhone(profile.cell_phone || profile.phone || "");
      }
    } catch (error) {
      console.error("Error loading agent profile:", error);
    }
  };

  const loadListingPreview = async () => {
    if (listingIds.length === 0) return;

    try {
      const { data } = await supabase
        .from("listings")
        .select("address, city, state, zip_code, price, bedrooms, bathrooms, square_feet")
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
        });
      }
    } catch (error) {
      console.error("Error loading listing preview:", error);
    }
  };

  const handleSelectClient = (client: Client) => {
    setRecipientName(`${client.first_name} ${client.last_name}`);
    setRecipientEmail(client.email);
    setClientSearch(`${client.first_name} ${client.last_name}`);
    setShowClientDropdown(false);
    setShowManualEntry(false);
  };

  const handleShare = async () => {
    if (!recipientName || !recipientEmail || !agentName || !agentEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      const formattedPhone = agentPhone ? formatPhoneNumber(agentPhone) : "";
      
      const { error } = await supabase.functions.invoke("send-bulk-listing-share", {
        body: {
          listingIds,
          recipientName,
          recipientEmail,
          agentName,
          agentEmail,
          agentPhone: formattedPhone,
          message,
        },
      });

      if (error) throw error;

      // Track the share for each listing
      const { trackShare } = await import("@/lib/trackShare");
      await Promise.all(
        listingIds.map(listingId => trackShare(listingId, 'email_bulk', recipientEmail))
      );

      toast.success(`Successfully shared ${listingCount} listing${listingCount > 1 ? 's' : ''}`);
      setOpen(false);
    } catch (error) {
      console.error("Error sharing listings:", error);
      toast.error("Failed to share listings");
    } finally {
      setSending(false);
    }
  };

  // Validation: require sender name + email, recipient email, and at least one listing
  const canSubmit = Boolean(
    agentName.trim() && 
    agentEmail.trim() && 
    recipientEmail.trim() && 
    listingIds.length > 0
  );

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="mr-2 h-4 w-4" />
        Share Selected ({listingCount})
      </Button>

      <ShareListingsDialog
        open={open}
        onOpenChange={setOpen}
        selectedCount={listingCount}
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
      />
    </>
  );
}
