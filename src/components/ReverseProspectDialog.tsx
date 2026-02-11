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
import { propertyTypeToEnum } from "@/lib/utils";
import { Loader2, MapPin, DollarSign, Home, Users, User } from "lucide-react";

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
  agentCount: number;
  buyerCount: number;
}

interface AgentGroup {
  userId: string;
  agentName: string;
  agentEmail: string;
  isConsumer: boolean;
  clientNames: string[];
}

export function ReverseProspectDialog({
  open,
  onOpenChange,
  listing,
  agentCount,
  buyerCount,
}: ReverseProspectDialogProps) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    if (open && listing) {
      loadMatches();
      loadAgentProfile();
    }
  }, [open, listing]);

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

  const matchesListing = (criteria: any): boolean => {
    if (!criteria) return false;
    if (criteria.min_price && listing.price < criteria.min_price) return false;
    if (criteria.max_price && listing.price > criteria.max_price) return false;
    if (criteria.bedrooms != null && (listing.bedrooms == null || listing.bedrooms < criteria.bedrooms)) return false;
    if (criteria.bathrooms != null && (listing.bathrooms == null || listing.bathrooms < criteria.bathrooms)) return false;
    if (criteria.city?.trim() && listing.city?.toLowerCase() !== criteria.city.toLowerCase()) return false;
    if (criteria.state?.trim() && listing.state?.toLowerCase() !== criteria.state.toLowerCase()) return false;
    if (criteria.property_type?.trim()) {
      const listingType = propertyTypeToEnum(listing.property_type || "");
      if (!listingType || listingType !== criteria.property_type) return false;
    }
    return true;
  };

  const loadMatches = async () => {
    try {
      setLoadingMatches(true);

      // Fetch active hot sheets
      const { data: hotSheets, error } = await supabase
        .from("hot_sheets")
        .select("id, criteria, user_id, name, client_id")
        .eq("is_active", true);

      if (error) throw error;
      if (!hotSheets || hotSheets.length === 0) {
        setAgentGroups([]);
        return;
      }

      // Filter matching sheets
      const matchingSheets = hotSheets.filter(sheet => matchesListing(sheet.criteria as any));

      if (matchingSheets.length === 0) {
        setAgentGroups([]);
        return;
      }

      // Get hot_sheet_clients for matching sheets
      const matchingIds = matchingSheets.map(s => s.id);
      const { data: hotSheetClients } = await supabase
        .from("hot_sheet_clients")
        .select("hot_sheet_id, client_id")
        .in("hot_sheet_id", matchingIds);

      // Get client details
      const clientIds = [...new Set((hotSheetClients || []).map(hsc => hsc.client_id))];
      let clientsMap: Record<string, { first_name: string; last_name: string }> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, first_name, last_name")
          .in("id", clientIds);
        if (clients) {
          clients.forEach(c => { clientsMap[c.id] = { first_name: c.first_name, last_name: c.last_name }; });
        }
      }

      // Build a map of hot_sheet_id -> client names
      const sheetClientNames: Record<string, string[]> = {};
      (hotSheetClients || []).forEach(hsc => {
        if (!sheetClientNames[hsc.hot_sheet_id]) sheetClientNames[hsc.hot_sheet_id] = [];
        const client = clientsMap[hsc.client_id];
        if (client) {
          sheetClientNames[hsc.hot_sheet_id].push(`${client.first_name} ${client.last_name}`.trim());
        }
      });

      // Group matching sheets by user_id (agent)
      const groupedByAgent: Record<string, { sheets: typeof matchingSheets; clientNames: string[] }> = {};
      matchingSheets.forEach(sheet => {
        if (!groupedByAgent[sheet.user_id]) {
          groupedByAgent[sheet.user_id] = { sheets: [], clientNames: [] };
        }
        groupedByAgent[sheet.user_id].sheets.push(sheet);
        const names = sheetClientNames[sheet.id];
        if (names && names.length > 0) {
          groupedByAgent[sheet.user_id].clientNames.push(...names);
        } else {
          // No linked clients -- use the hot sheet name as the buyer name
          groupedByAgent[sheet.user_id].clientNames.push(sheet.name || "Direct Buyer");
        }
      });

      // Look up agent profiles for all user_ids
      const userIds = Object.keys(groupedByAgent);
      const { data: agentProfiles } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      const agentProfileMap: Record<string, { first_name: string; last_name: string; email: string }> = {};
      (agentProfiles || []).forEach(p => { agentProfileMap[p.id] = p; });

      // For consumer users without agent profiles, look up in profiles table
      const missingUserIds = userIds.filter(id => !agentProfileMap[id]);
      let consumerProfileMap: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};
      if (missingUserIds.length > 0) {
        const { data: consumerProfiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", missingUserIds);
        (consumerProfiles || []).forEach(p => { consumerProfileMap[p.id] = p; });
      }

      // Build agent groups
      const groups: AgentGroup[] = userIds.map(userId => {
        const group = groupedByAgent[userId];
        const agentProfile = agentProfileMap[userId];
        const consumerProfile = consumerProfileMap[userId];

        // Deduplicate client names
        const uniqueNames = [...new Set(group.clientNames)];

        if (agentProfile) {
          return {
            userId,
            agentName: `${agentProfile.first_name} ${agentProfile.last_name}`.trim(),
            agentEmail: agentProfile.email,
            isConsumer: false,
            clientNames: uniqueNames,
          };
        } else if (consumerProfile) {
          return {
            userId,
            agentName: `${consumerProfile.first_name || ''} ${consumerProfile.last_name || ''}`.trim() || "Direct Buyer",
            agentEmail: consumerProfile.email,
            isConsumer: true,
            clientNames: uniqueNames,
          };
        } else {
          return {
            userId,
            agentName: "Unknown",
            agentEmail: "",
            isConsumer: true,
            clientNames: uniqueNames,
          };
        }
      }).filter(g => g.agentEmail);

      setAgentGroups(groups);
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

    if (agentGroups.length === 0) {
      toast.error("No matching agents found");
      return;
    }

    try {
      setSending(true);

      // Build recipients: one per agent with their matching client names
      const recipients = agentGroups.map(group => ({
        email: group.agentEmail,
        first_name: group.agentName.split(' ')[0] || group.agentName,
        last_name: group.agentName.split(' ').slice(1).join(' ') || '',
        matchingClientNames: group.clientNames,
      }));

      const { error: sendError } = await supabase.functions.invoke("send-reverse-prospecting", {
        body: {
          recipients,
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

      toast.success(`Message sent to ${recipients.length} agent${recipients.length !== 1 ? 's' : ''}!`);
      onOpenChange(false);
      setMessage("");
    } catch (error: any) {
      console.error("Error sending messages:", error);
      toast.error("Failed to send messages: " + error.message);
    } finally {
      setSending(false);
    }
  };

  if (!listing) return null;

  const totalBuyers = agentGroups.reduce((sum, g) => sum + g.clientNames.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Reverse Prospect: {agentGroups.length} Agent{agentGroups.length !== 1 ? 's' : ''}, {totalBuyers} Prospective Buyer{totalBuyers !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            Send your listing to agents whose clients are actively looking for similar properties
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
            {listing.bathrooms && <span>{listing.bathrooms} bath</span>}
            {listing.square_feet && <span>{listing.square_feet.toLocaleString()} sqft</span>}
          </div>
        </div>

        {/* Matching Agents & Buyers */}
        {loadingMatches ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">
              Matching Agents ({agentGroups.length}) · Prospective Buyers ({totalBuyers})
            </h3>
            <div className="max-h-[250px] overflow-y-auto space-y-3">
              {agentGroups.map((group) => (
                <div key={group.userId} className="p-3 bg-muted/30 rounded-md text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    {group.isConsumer ? (
                      <User className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Users className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{group.agentName}</span>
                    {group.isConsumer && (
                      <Badge variant="secondary" className="text-xs">Direct Buyer</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground ml-6">{group.agentEmail}</div>
                  <div className="ml-6 flex flex-wrap gap-1">
                    {group.clientNames.map((name, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
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
              placeholder="I have a property that matches your client's search criteria..."
              className="min-h-[120px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Each agent receives one email listing all their matching clients
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || agentGroups.length === 0}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              `Send to ${agentGroups.length} Agent${agentGroups.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
