import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Share2, Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";

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
  const [showSaveContactPrompt, setShowSaveContactPrompt] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      setShowSaveContactPrompt(false);
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
        const results = data || [];
        setClientResults(results);
        setShowClientDropdown(results.length > 0);
        // Show save prompt when no results found
        setShowSaveContactPrompt(results.length === 0);
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

  const handleSelectClient = (client: Client) => {
    setRecipientName(`${client.first_name} ${client.last_name}`);
    setRecipientEmail(client.email);
    setClientSearch(`${client.first_name} ${client.last_name}`);
    setShowClientDropdown(false);
    setShowSaveContactPrompt(false);
  };

  const handleSaveNewContact = async () => {
    if (!recipientName.trim() || !recipientEmail.trim()) {
      toast.error("Please enter both name and email to save contact");
      return;
    }

    setSavingContact(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const nameParts = recipientName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { error } = await supabase
        .from("clients")
        .insert({
          agent_id: user.id,
          first_name: firstName,
          last_name: lastName,
          email: recipientEmail.trim(),
          client_type: 'buyer'
        });

      if (error) throw error;
      
      toast.success(`${recipientName} saved to My Contacts`);
      setShowSaveContactPrompt(false);
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error("Failed to save contact");
    } finally {
      setSavingContact(false);
    }
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Share2 className="mr-2 h-4 w-4" />
          Share Selected ({listingCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share {listingCount} Listing{listingCount > 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Send these selected listings to a contact via email
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
          
          {showSaveContactPrompt && !showClientDropdown && recipientName && recipientEmail && (
            <div className="p-3 bg-muted/50 rounded-md border border-dashed">
              <p className="text-sm text-muted-foreground mb-2">
                Contact not found. Would you like to save "{recipientName}" to My Contacts?
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveNewContact}
                disabled={savingContact}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                {savingContact ? "Saving..." : "Save to My Contacts"}
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="recipientName">Recipient Name *</Label>
            <Input
              id="recipientName"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Enter recipient's name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">Recipient Email *</Label>
            <Input
              id="recipientEmail"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agentName">Your Name *</Label>
            <Input
              id="agentName"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agentEmail">Your Email *</Label>
            <Input
              id="agentEmail"
              type="email"
              value={agentEmail}
              onChange={(e) => setAgentEmail(e.target.value)}
              placeholder="your@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agentPhone">Your Phone</Label>
            <FormattedInput
              id="agentPhone"
              format="phone"
              value={agentPhone}
              onChange={setAgentPhone}
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to include with the listings..."
              rows={3}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleShare} disabled={sending}>
            {sending ? "Sharing..." : "Share Listings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
