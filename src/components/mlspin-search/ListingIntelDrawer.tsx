import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Calendar, 
  DollarSign, 
  User, 
  MessageSquare, 
  Heart, 
  ExternalLink,
  Users,
  Home,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Listing {
  id: string;
  listing_number: string;
  address: string;
  unit_number?: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  status: string;
  list_date?: string;
  property_type?: string;
  agent_id: string;
  agent_name?: string;
  description?: string;
  photos?: any;
  year_built?: number;
  lot_size?: number;
}

interface ListingIntelDrawerProps {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
};

const formatAddress = (listing: Listing) => {
  let addr = listing.address;
  if (listing.unit_number) {
    addr += ` #${listing.unit_number}`;
  }
  return `${addr}, ${listing.city}, ${listing.state} ${listing.zip_code}`;
};

const ListingIntelDrawer = ({ listing, open, onOpenChange }: ListingIntelDrawerProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [matchingBuyers, setMatchingBuyers] = useState<any[]>([]);
  const [listingStats, setListingStats] = useState<any>(null);

  useEffect(() => {
    if (listing && open) {
      fetchIntelData();
    }
  }, [listing, open]);

  const fetchIntelData = async () => {
    if (!listing) return;
    setLoading(true);

    try {
      // Fetch agent profile
      const { data: agent } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", listing.agent_id)
        .single();

      setAgentProfile(agent);

      // Fetch listing stats
      const { data: stats } = await supabase
        .from("listing_stats")
        .select("*")
        .eq("listing_id", listing.id)
        .single();

      setListingStats(stats);

      // Fetch matching buyer needs (simplified query)
      const { data: buyers } = await supabase
        .from("client_needs")
        .select("*, agent:submitted_by(first_name, last_name)")
        .lte("max_price", listing.price * 1.1)
        .limit(5);

      setMatchingBuyers(buyers || []);
    } catch (error) {
      console.error("Error fetching intel data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Status badge now uses centralized StatusBadge component

  const photos = listing?.photos as string[] | undefined;
  const primaryPhoto = photos?.[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <ScrollArea className="h-full">
          {listing && (
            <div className="pb-6">
              {/* Hero Image */}
              {primaryPhoto && (
                <div className="relative h-48 bg-muted">
                  <img
                    src={primaryPhoto}
                    alt={listing.address}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3">
                    <ListingStatusBadge status={listing.status} />
                  </div>
                </div>
              )}

              <div className="p-4 space-y-4">
                {/* Header */}
                <div>
                  <SheetHeader className="text-left p-0">
                    <SheetTitle className="text-xl">{formatPrice(listing.price)}</SheetTitle>
                  </SheetHeader>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {formatAddress(listing)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    List # {listing.listing_number}
                  </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <Bed className="h-4 w-4 mx-auto text-muted-foreground" />
                    <p className="text-sm font-semibold mt-1">{listing.bedrooms || "-"}</p>
                    <p className="text-[10px] text-muted-foreground">Beds</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <Bath className="h-4 w-4 mx-auto text-muted-foreground" />
                    <p className="text-sm font-semibold mt-1">{listing.bathrooms || "-"}</p>
                    <p className="text-[10px] text-muted-foreground">Baths</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <Square className="h-4 w-4 mx-auto text-muted-foreground" />
                    <p className="text-sm font-semibold mt-1">{listing.square_feet?.toLocaleString() || "-"}</p>
                    <p className="text-[10px] text-muted-foreground">SqFt</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <Calendar className="h-4 w-4 mx-auto text-muted-foreground" />
                    <p className="text-sm font-semibold mt-1">{listing.year_built || "-"}</p>
                    <p className="text-[10px] text-muted-foreground">Built</p>
                  </div>
                </div>

                <Separator />

                {/* Listing Agent */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Listing Agent
                  </h3>
                  {loading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : agentProfile ? (
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        {agentProfile.headshot_url ? (
                          <img
                            src={agentProfile.headshot_url}
                            alt={`${agentProfile.first_name} ${agentProfile.last_name}`}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {agentProfile.first_name} {agentProfile.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{agentProfile.company}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="h-8">
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        Message
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Agent info unavailable</p>
                  )}
                </div>

                <Separator />

                {/* Listing Stats */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Listing Activity
                  </h3>
                  {loading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : listingStats ? (
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <p className="text-lg font-semibold">{listingStats.view_count || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Views</p>
                      </div>
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <p className="text-lg font-semibold">{listingStats.save_count || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Saves</p>
                      </div>
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <p className="text-lg font-semibold">{listingStats.share_count || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Shares</p>
                      </div>
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <p className="text-lg font-semibold">{listingStats.showing_request_count || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Showings</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No activity data yet</p>
                  )}
                </div>

                <Separator />

                {/* Matching Buyers */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Potential Buyer Matches ({matchingBuyers.length})
                  </h3>
                  {loading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : matchingBuyers.length > 0 ? (
                    <div className="space-y-2">
                      {matchingBuyers.slice(0, 3).map((buyer: any) => (
                        <div key={buyer.id} className="p-2 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium">
                                {buyer.agent?.first_name} {buyer.agent?.last_name}'s Buyer
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Looking for {buyer.property_type} up to ${(buyer.max_price / 1000).toFixed(0)}K
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">Match</Badge>
                          </div>
                        </div>
                      ))}
                      {matchingBuyers.length > 3 && (
                        <p className="text-xs text-center text-muted-foreground">
                          +{matchingBuyers.length - 3} more matches
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No matching buyers found</p>
                  )}
                </div>

                <Separator />

                {/* Description */}
                {listing.description && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Description
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-4">
                      {listing.description}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/property/${listing.id}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Full Details
                  </Button>
                  <Button variant="outline" size="icon">
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default ListingIntelDrawer;
