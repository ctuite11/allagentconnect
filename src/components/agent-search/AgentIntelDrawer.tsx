import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  ExternalLink, 
  Home, 
  Users,
  TrendingUp,
  Gift,
  Clock
} from "lucide-react";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import { formatPhoneNumber } from "@/lib/phoneFormat";

interface AgentIntelDrawerProps {
  agent: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AgentIntelDrawer = ({ agent, open, onOpenChange }: AgentIntelDrawerProps) => {
  const navigate = useNavigate();
  const [buyerNeeds, setBuyerNeeds] = useState<any[]>([]);
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [coverageAreas, setCoverageAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (agent && open) {
      fetchAgentIntel();
    }
  }, [agent, open]);

  const fetchAgentIntel = async () => {
    if (!agent) return;
    setLoading(true);
    
    try {
      // Fetch buyer needs submitted by this agent
      const { data: needs } = await supabase
        .from("client_needs")
        .select("*")
        .eq("submitted_by", agent.id)
        .order("created_at", { ascending: false })
        .limit(3);
      
      setBuyerNeeds(needs || []);

      // Fetch recent active listings by this agent
      const { data: listings } = await supabase
        .from("listings")
        .select("id, address, city, state, price, property_type, created_at")
        .eq("agent_id", agent.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5);
      
      setRecentListings(listings || []);

      // Fetch coverage areas
      const { data: areas } = await supabase
        .from("agent_buyer_coverage_areas")
        .select("*")
        .eq("agent_id", agent.id)
        .limit(5);
      
      setCoverageAreas(areas || []);
    } catch (error) {
      console.error("Error fetching agent intel:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!agent) return null;

  const agentName = `${agent.first_name} ${agent.last_name}`;
  const initials = `${agent.first_name?.[0] || ''}${agent.last_name?.[0] || ''}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              {agent.headshot_url && <AvatarImage src={agent.headshot_url} alt={agentName} />}
              <AvatarFallback className="text-lg font-semibold bg-muted text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg truncate">{agentName}</SheetTitle>
              {agent.company && (
                <p className="text-sm text-muted-foreground truncate">{agent.company}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">ID: {agent.aac_id}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pt-4">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <ContactAgentProfileDialog
              agentId={agent.id}
              agentName={agentName}
              agentEmail={agent.email}
              buttonText="Message"
            />
            <Button 
              variant="outline" 
              onClick={() => {
                navigate(`/agent/${agent.id}`);
                onOpenChange(false);
              }}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Profile
            </Button>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Contact
            </h4>
            <div className="space-y-2 pl-6 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <a href={`mailto:${agent.email}`} className="hover:text-primary truncate">
                  {agent.email}
                </a>
              </div>
              {agent.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <a href={`tel:${agent.phone}`} className="hover:text-primary">
                    {formatPhoneNumber(agent.phone)}
                  </a>
                </div>
              )}
              {agent.office_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{agent.office_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Buyer Incentives - hidden per AAC policy */}
          {false && agent.buyer_incentives && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Gift className="h-4 w-4 text-green-600" />
                  Buyer Incentives
                </h4>
                <p className="text-sm text-muted-foreground pl-6">{agent.buyer_incentives}</p>
              </div>
            </>
          )}

          {/* Active Listings */}
          {recentListings.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Home className="h-4 w-4 text-blue-600" />
                  Active Listings
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {agent.active_listings_count || recentListings.length}
                  </Badge>
                </h4>
                <div className="space-y-2 pl-6">
                  {recentListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 hover:bg-muted cursor-pointer"
                      onClick={() => {
                        navigate(`/properties/${listing.id}`);
                        onOpenChange(false);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{listing.address}</p>
                        <p className="text-xs text-muted-foreground">{listing.city}, {listing.state}</p>
                      </div>
                      <p className="text-sm font-semibold text-primary ml-2">
                        ${listing.price?.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Buyer Needs Submitted */}
          {buyerNeeds.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  Active Buyer Needs
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {buyerNeeds.length}
                  </Badge>
                </h4>
                <div className="space-y-2 pl-6">
                  {buyerNeeds.map((need) => (
                    <div
                      key={need.id}
                      className="py-2 px-3 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm capitalize">{need.property_type?.replace('_', ' ')}</span>
                        <span className="text-sm font-medium">
                          Up to ${need.max_price?.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {need.city && `${need.city}, `}{need.state}
                        {need.bedrooms && ` • ${need.bedrooms}+ beds`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Coverage Areas */}
          {coverageAreas.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-teal-600" />
                  Coverage Areas
                </h4>
                <div className="flex flex-wrap gap-1.5 pl-6">
                  {coverageAreas.map((area) => (
                    <Badge key={area.id} variant="outline" className="text-xs">
                      {area.city || area.zip_code}, {area.state}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Service Areas (Counties) */}
          {agent.agent_county_preferences && agent.agent_county_preferences.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Service Areas
                </h4>
                <div className="flex flex-wrap gap-1.5 pl-6">
                  {agent.agent_county_preferences.map((pref: any) => (
                    <Badge key={pref.county_id} variant="secondary" className="text-xs">
                      {pref.counties?.name}, {pref.counties?.state}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Loading intel...</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AgentIntelDrawer;
