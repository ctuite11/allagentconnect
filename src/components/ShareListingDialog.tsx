import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";

interface ShareListingDialogProps {
  listingId: string;
  listingAddress: string;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
}

export const ShareListingDialog = ({ listingId, listingAddress }: ShareListingDialogProps) => {
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
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadAgentProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('agent_profiles')
        .select('first_name, last_name, email, cell_phone, phone')
        .eq('id', user.id)
        .single();

      if (profile) {
        setAgentName(`${profile.first_name} ${profile.last_name}`);
        setAgentEmail(profile.email);
        setAgentPhone(profile.cell_phone || profile.phone || '');
      }
    };

    if (open) {
      loadAgentProfile();
    } else {
      // Reset form when closing
      setRecipientName("");
      setRecipientEmail("");
      setMessage("");
      setClientSearch("");
      setClientResults([]);
      setShowClientDropdown(false);
    }
  }, [open]);

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
        setClientResults(data || []);
        setShowClientDropdown((data || []).length > 0);
      } catch (error) {
        console.error("Error searching clients:", error);
      }
    };

    const debounce = setTimeout(searchClients, 300);
    return () => clearTimeout(debounce);
  }, [clientSearch]);

  const handleSelectClient = (client: Client) => {
    setRecipientName(`${client.first_name} ${client.last_name}`);
    setRecipientEmail(client.email);
    setClientSearch(`${client.first_name} ${client.last_name}`);
    setShowClientDropdown(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="w-4 h-4 mr-2" />
          Share Listing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Listing</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground mb-4">
            <strong>Property:</strong> {listingAddress}
          </div>

          <div className="space-y-2" ref={clientSearchRef}>
            <Label htmlFor="clientSearch">Search Contact</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="clientSearch"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-9"
              />
            </div>
            {showClientDropdown && clientResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                {clientResults.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <div className="font-medium">{client.first_name} {client.last_name}</div>
                    <div className="text-sm text-muted-foreground">{client.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientName">Recipient Name *</Label>
            <Input
              id="recipientName"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientEmail">Recipient Email *</Label>
            <Input
              id="recipientEmail"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Your Contact Information</h4>
            
            <div className="space-y-2">
              <Label htmlFor="agentName">Your Name *</Label>
              <Input
                id="agentName"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2 mt-3">
              <Label htmlFor="agentEmail">Your Email *</Label>
              <Input
                id="agentEmail"
                type="email"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2 mt-3">
              <Label htmlFor="agentPhone">Your Phone</Label>
              <FormattedInput
                id="agentPhone"
                format="phone"
                value={agentPhone}
                onChange={(value) => setAgentPhone(value)}
                placeholder="1234567890"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message for the recipient..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={sending}>
              {sending ? "Sending..." : "Share Listing"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
