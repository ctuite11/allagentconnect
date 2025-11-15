import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, DollarSign, Home } from "lucide-react";

interface ReverseProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    address: string;
    city: string;
    state: string;
    price: number;
    property_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    square_feet: number | null;
  };
  matchCount: number;
}

interface ClientNeed {
  id: string;
  property_type: string;
  city: string;
  state: string;
  max_price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  submitted_by: string;
}

export function ReverseProspectDialog({
  open,
  onOpenChange,
  listing,
  matchCount,
}: ReverseProspectDialogProps) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [matches, setMatches] = useState<ClientNeed[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    if (open) {
      loadMatches();
      loadAgentProfile();
    }
  }, [open]);

  const loadAgentProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name, email, cell_phone")
        .eq("id", user.id)
        .single();

      if (profile) {
        setAgentName(`${profile.first_name} ${profile.last_name}`.trim());
        setAgentEmail(profile.email);
        setAgentPhone(profile.cell_phone || "");
      }
    } catch (error) {
      console.error("Error loading agent profile:", error);
    }
  };

  const loadMatches = async () => {
    try {
      setLoadingMatches(true);
      let query = supabase
        .from("client_needs")
        .select("*");

      // Match by state
      if (listing.state) {
        query = query.eq("state", listing.state);
      }

      // Match by city
      if (listing.city) {
        query = query.ilike("city", `%${listing.city}%`);
      }

      // Match by property type
      if (listing.property_type) {
        query = query.eq("property_type", listing.property_type as any);
      }

      // Match by price (listing price should be at or below max_price)
      if (listing.price) {
        query = query.gte("max_price", listing.price);
      }

      // Match by bedrooms
      if (listing.bedrooms) {
        query = query.lte("bedrooms", listing.bedrooms);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error("Error loading matches:", error);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    if (!agentName.trim() || !agentEmail.trim()) {
      toast.error("Please enter your name and email");
      return;
    }

    try {
      setSending(true);

      // Get unique user profiles
      const userIds = [...new Set(matches.map(match => match.submitted_by))];
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("email, first_name, last_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        toast.error("No matching buyers found");
        return;
      }

      // Call edge function to send emails
      const { error: sendError } = await supabase.functions.invoke("send-reverse-prospecting", {
        body: {
          recipients: profiles,
          agentName,
          agentEmail,
          agentPhone: agentPhone || null,
          message,
          listingAddress: `${listing.address}, ${listing.city}, ${listing.state}`,
          listingPrice: `$${listing.price.toLocaleString()}`,
          filters: {
            state: listing.state,
            city: listing.city,
            propertyType: listing.property_type,
          },
        },
      });

      if (sendError) throw sendError;

      toast.success(`Message sent to ${profiles.length} potential buyers!`);
      onOpenChange(false);
      
      // Reset form
      setMessage("");
    } catch (error: any) {
      console.error("Error sending messages:", error);
      toast.error("Failed to send messages: " + error.message);
    } finally {
      setSending(false);
    }
  };

  const formatPropertyType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reverse Prospect: {matchCount} Matching Buyers</DialogTitle>
          <DialogDescription>
            Send your listing to buyers actively looking for similar properties
          </DialogDescription>
        </DialogHeader>

        {/* Listing Summary */}
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h3 className="font-semibold">Your Listing</h3>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <span>{listing.address}, {listing.city}, {listing.state}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span>${listing.price.toLocaleString()}</span>
            </div>
            {listing.bedrooms && (
              <div className="flex items-center gap-1">
                <Home className="w-4 h-4 text-muted-foreground" />
                <span>{listing.bedrooms} bed</span>
              </div>
            )}
            {listing.bathrooms && (
              <span>{listing.bathrooms} bath</span>
            )}
            {listing.square_feet && (
              <span>{listing.square_feet.toLocaleString()} sqft</span>
            )}
          </div>
        </div>

        {/* Matching Buyers Preview */}
        {loadingMatches ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Matching Buyer Criteria ({matches.length})</h3>
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {matches.slice(0, 5).map((match) => (
                <div key={match.id} className="p-3 bg-muted/30 rounded-md text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      {formatPropertyType(match.property_type)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {match.city}, {match.state}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Max Budget: ${match.max_price.toLocaleString()}
                    {match.bedrooms && ` • ${match.bedrooms}+ bed`}
                    {match.bathrooms && ` • ${match.bathrooms}+ bath`}
                  </div>
                </div>
              ))}
              {matches.length > 5 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  + {matches.length - 5} more matching buyers
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4 py-4 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agentName">Your Name *</Label>
              <Input
                id="agentName"
                placeholder="John Doe"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="agentEmail">Your Email *</Label>
              <Input
                id="agentEmail"
                type="email"
                placeholder="agent@example.com"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="agentPhone">Your Phone (Optional)</Label>
            <FormattedInput
              id="agentPhone"
              format="phone"
              placeholder="1234567890"
              value={agentPhone}
              onChange={(value) => setAgentPhone(value)}
            />
          </div>

          <div>
            <Label htmlFor="message">Your Message *</Label>
            <Textarea
              id="message"
              placeholder="I have a property that matches your search criteria..."
              className="min-h-[120px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This message will be sent to all matching buyers
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || matches.length === 0}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              `Send to ${matches.length} Buyers`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
