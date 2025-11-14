import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Home, Edit, Trash2, Eye, Calendar, Users, Mail, Heart, Star, BarChart3, Sparkles, TrendingDown, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ReverseProspectDialog } from "./ReverseProspectDialog";
import MarketInsightsDialog from "./MarketInsightsDialog";
interface ListingCardProps {
  listing: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    price: number;
    property_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    square_feet: number | null;
    status: string;
    photos?: any;
    open_houses?: any;
    listing_type?: string | null;
    created_at?: string;
    active_date?: string | null;
    listing_number?: string | null;
    is_relisting?: boolean;
    original_listing_id?: string | null;
    condo_details?: any;
    cancelled_at?: string | null;
    listing_stats?: {
      view_count: number;
      save_count: number;
      contact_count: number;
      showing_request_count: number;
      cumulative_active_days: number;
    };
  };
  onReactivate?: (id: string) => void;
  viewMode?: 'grid' | 'list';
}
const ListingCard = ({
  listing,
  onReactivate,
  viewMode = 'grid'
}: ListingCardProps) => {
  const navigate = useNavigate();
  const [matchCount, setMatchCount] = useState<number>(0);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [prospectDialogOpen, setProspectDialogOpen] = useState(false);
  const [marketInsightsOpen, setMarketInsightsOpen] = useState(false);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  useEffect(() => {
    loadMatchCount();
    loadStatusHistory();
  }, [listing.id]);
  const loadStatusHistory = async () => {
    try {
      const {
        data
      } = await supabase.from("listing_status_history").select("*").eq("listing_id", listing.id).order("changed_at", {
        ascending: false
      }).limit(5);
      if (data) {
        setStatusHistory(data);
      }
    } catch (error) {
      console.error("Error loading status history:", error);
    }
  };
  const loadMatchCount = async () => {
    try {
      setLoadingMatches(true);
      let query = supabase.from("client_needs").select("id", {
        count: "exact",
        head: true
      });

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
      const {
        count
      } = await query;
      setMatchCount(count || 0);
    } catch (error) {
      console.error("Error loading match count:", error);
    } finally {
      setLoadingMatches(false);
    }
  };
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(price);
  };
  const getFirstPhoto = () => {
    if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
      const photo = listing.photos[0];

      // If it's a string, assume it's already a URL
      if (typeof photo === 'string') {
        return photo;
      }

      // If it's an object with a url property
      if (photo.url) {
        // Check if it's a full URL or a storage path
        if (photo.url.startsWith('http')) {
          return photo.url;
        }
        // If it's a storage path, construct the public URL
        const {
          data
        } = supabase.storage.from('listing-photos').getPublicUrl(photo.url);
        return data.publicUrl;
      }
    }
    return null;
  };
  const hasUpcomingOpenHouse = () => {
    if (!listing.open_houses || !Array.isArray(listing.open_houses)) return false;
    const now = new Date();
    return listing.open_houses.some((oh: any) => {
      const ohEndDateTime = new Date(`${oh.date}T${oh.end_time}`);
      return ohEndDateTime > now;
    });
  };
  const getNextOpenHouse = () => {
    if (!listing.open_houses || !Array.isArray(listing.open_houses)) return null;
    const now = new Date();
    const upcoming = listing.open_houses.filter((oh: any) => {
      const ohEndDateTime = new Date(`${oh.date}T${oh.end_time}`);
      return ohEndDateTime > now;
    }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] || null;
  };
  const getStatusChangeBanner = () => {
    if (statusHistory.length === 0) return null;
    const currentStatus = statusHistory[0]?.new_status;

    // Check if listing is new (not a relisting and active within last 7 days)
    // NEW shows if: first time active OR relisted after 30 days OR relisted with different agent
    const allActiveStatuses = statusHistory.filter(h => h.new_status === 'active');
    if (currentStatus === 'active' && !listing.is_relisting) {
      // This is either a brand new listing or relisted after 30+ days or with different agent
      if (allActiveStatuses.length >= 1) {
        const mostRecentActiveDate = new Date(allActiveStatuses[0].changed_at);
        const daysSinceActive = Math.ceil((Date.now() - mostRecentActiveDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceActive <= 7) {
          return {
            text: "NEW LISTING",
            color: "bg-blue-600",
            iconType: "sparkles" as const
          };
        }
      }
    }

    // Check if back on market (was pending, under_contract, withdrawn, or cancelled and now active again)
    // This applies when status changes within the same listing (not creating a new listing)
    if (statusHistory.length >= 2 && currentStatus === 'active') {
      const previousStatus = statusHistory[1]?.new_status;
      const changeDate = new Date(statusHistory[0].changed_at);
      const daysSinceChange = Math.ceil((Date.now() - changeDate.getTime()) / (1000 * 60 * 60 * 24));

      // List of statuses that when followed by active should show "BACK ON MARKET"
      const offMarketStatuses = ['pending', 'under_contract', 'withdrawn', 'cancelled', 'temporarily_withdrawn'];
      if (offMarketStatuses.includes(previousStatus) && daysSinceChange <= 14) {
        return {
          text: "BACK ON MARKET",
          color: "bg-orange-600",
          iconType: "refresh" as const
        };
      }
    }
    return null;
  };
  const getOpenHouseBanner = () => {
    const nextOH = getNextOpenHouse();
    if (!nextOH) return null;
    const isBrokerOnly = nextOH.type === 'broker';
    return {
      text: isBrokerOnly ? "BROKER OPEN HOUSE" : "OPEN HOUSE",
      date: format(new Date(nextOH.date), "MMM d"),
      time: `${nextOH.start_time} - ${nextOH.end_time}`,
      color: isBrokerOnly ? "bg-purple-600" : "bg-green-600",
      isBroker: isBrokerOnly
    };
  };
  const photoUrl = getFirstPhoto();
  const nextOpenHouse = getNextOpenHouse();
  const statusBanner = getStatusChangeBanner();
  const openHouseBanner = getOpenHouseBanner();

  // Color coding for match count
  const getMatchButtonStyle = () => {
    if (matchCount === 0) {
      return {
        variant: "outline" as const,
        className: "border-muted-foreground/20 text-muted-foreground hover:bg-muted"
      };
    } else if (matchCount >= 10) {
      // High demand - green
      return {
        variant: "default" as const,
        className: "bg-green-600 hover:bg-green-700 text-white border-green-600"
      };
    } else if (matchCount >= 5) {
      // Medium demand - yellow/amber
      return {
        variant: "default" as const,
        className: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
      };
    } else {
      // Low demand - blue/default
      return {
        variant: "outline" as const,
        className: "border-primary/50 text-primary hover:bg-primary/10"
      };
    }
  };
  const matchButtonStyle = getMatchButtonStyle();
  const getUnitNumber = () => {
    if (!listing.condo_details) return null;
    try {
      const details = typeof listing.condo_details === 'string' ? JSON.parse(listing.condo_details) : listing.condo_details;
      return details?.unit_number || null;
    } catch {
      return null;
    }
  };
  const unitNumber = getUnitNumber();
  const calculateDaysOnMarket = () => {
    // Use active_date (MLS date) if available, otherwise fall back to created_at
    const marketDate = listing.active_date || listing.created_at;
    if (!marketDate) return 0;
    const activeDate = new Date(marketDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - activeDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  const daysOnMarket = calculateDaysOnMarket();
  if (viewMode === 'list') {
    return <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex gap-3 p-3">
          {/* Photo with Banners */}
          <div className="relative w-40 h-40 flex-shrink-0">
            {photoUrl ? <img src={photoUrl} alt={listing.address} className="w-full h-full object-cover rounded" /> : <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                <Home className="w-8 h-8 text-muted-foreground" />
              </div>}
            
            {/* Status Change Banner (top priority) */}
            {statusBanner && <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-xs font-bold px-2 py-1 text-center flex items-center justify-center gap-1`}>
                {statusBanner.iconType === 'sparkles' ? <Sparkles className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                {statusBanner.text}
              </div>}
            
            {/* Open House Banner (secondary priority) */}
            {openHouseBanner && !statusBanner && <div className={`absolute top-0 left-0 right-0 ${openHouseBanner.color} text-white text-xs font-bold px-2 py-1 text-center`}>
                {openHouseBanner.isBroker ? '🏢' : '🎈'} {openHouseBanner.text}
              </div>}
            
            {/* Photo count badge */}
            <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
              {listing.photos?.length || 0} Photos
            </div>
          </div>

          {/* Listing Info */}
          <div className="flex-1 grid grid-cols-12 gap-3">
            <div className="col-span-6">
              <h3 className="font-semibold text-sm mb-1">
                {listing.address}
                {unitNumber && <Badge variant="secondary" className="ml-2 text-xs">
                    Unit {unitNumber}
                  </Badge>}
              </h3>
              <div className="flex items-center text-muted-foreground text-xs mb-1">
                <MapPin className="w-3 h-3 mr-1" />
                {listing.city}, {listing.state} {listing.zip_code}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                {listing.listing_number && <span>Listing #{listing.listing_number}</span>}
                {listing.is_relisting && <>
                    {listing.listing_number && <span>•</span>}
                    <Badge variant="secondary" className="text-xs">
                      Relisted
                    </Badge>
                  </>}
                {listing.listing_number && daysOnMarket > 0 && <span>•</span>}
                {daysOnMarket > 0 && <Badge variant="outline" className="text-xs">
                    {daysOnMarket} {daysOnMarket === 1 ? 'day' : 'days'} on market
                  </Badge>}
                {listing.listing_stats?.cumulative_active_days && listing.listing_stats.cumulative_active_days > daysOnMarket && <>
                    <span>•</span>
                    <Badge variant="secondary" className="text-xs">
                      {listing.listing_stats.cumulative_active_days} total active
                    </Badge>
                  </>}
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground mb-1">
                {listing.bedrooms && <span><Bed className="w-3 h-3 inline mr-0.5" />{listing.bedrooms}</span>}
                {listing.bathrooms && <span><Bath className="w-3 h-3 inline mr-0.5" />{listing.bathrooms}</span>}
                {listing.square_feet && <span><Home className="w-3 h-3 inline mr-0.5" />{listing.square_feet.toLocaleString()} sqft</span>}
              </div>
              {listing.status === 'active' && <Button size="sm" variant={matchButtonStyle.variant} onClick={() => setProspectDialogOpen(true)} disabled={matchCount === 0 || loadingMatches} className={`mt-1 text-xs h-6 ${matchButtonStyle.className}`}>
                  <Users className="w-3 h-3 mr-1" />
                  {loadingMatches ? "Loading..." : matchCount > 0 ? `${matchCount} matches` : "0 matches"}
                </Button>}
            </div>

            <div className="col-span-2">
              <Badge variant={listing.status === "active" ? "default" : "secondary"} className="mb-1 text-xs">
                {listing.status}
              </Badge>
              {listing.property_type && <div className="text-xs text-muted-foreground">{listing.property_type}</div>}
            </div>

            <div className="col-span-2 text-right">
              <div className="text-base font-bold text-primary mb-0.5">
                {formatPrice(listing.price)}
              </div>
              <div className="text-xs text-muted-foreground">
                {listing.listing_type === 'for_rent' ? 'Rental' : 'Sale'}
              </div>
              {listing.created_at && <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(listing.created_at), "MM/dd/yy")}
                </div>}
            </div>

            <div className="col-span-2 flex flex-col gap-1 justify-center">
              <Button variant="outline" size="sm" onClick={() => {
                sessionStorage.setItem('fromAgentDashboard', 'true');
                navigate(`/property/${listing.id}`);
              }} className="w-full">
                <Eye className="w-3 h-3 mr-1" />
                View
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/analytics/${listing.id}`)} className="w-full">
                <BarChart3 className="w-3 h-3 mr-1" />
                Stats
              </Button>
              <Button variant="outline" size="sm" onClick={e => {
              e.stopPropagation();
              setMarketInsightsOpen(true);
            }} className="w-full">
                <TrendingDown className="w-3 h-3 mr-1" />
                Market
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/edit-listing/${listing.id}`)} className="w-full">
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              {listing.status === 'cancelled' && onReactivate && <Button variant="default" size="sm" onClick={() => onReactivate(listing.id)} className="w-full bg-green-600 hover:bg-green-700">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reactivate
                </Button>}
            </div>
          </div>
        </div>
        {openHouseBanner && <div className={`${openHouseBanner.isBroker ? 'bg-purple-50 border-t border-purple-200' : 'bg-green-50 border-t border-green-200'} px-3 py-1.5 text-xs`}>
            <Calendar className={`w-4 h-4 inline mr-2 ${openHouseBanner.isBroker ? 'text-purple-600' : 'text-green-600'}`} />
            <span className={`font-semibold ${openHouseBanner.isBroker ? 'text-purple-700' : 'text-green-700'}`}>
              {openHouseBanner.isBroker ? 'Broker Open House:' : 'Open House:'}
            </span>{" "}
            {format(new Date(nextOpenHouse.date), "EEEE, MMMM d, yyyy")} • {openHouseBanner.time}
          </div>}
        <ReverseProspectDialog open={prospectDialogOpen} onOpenChange={setProspectDialogOpen} listing={listing} matchCount={matchCount} />
        <MarketInsightsDialog open={marketInsightsOpen} onOpenChange={setMarketInsightsOpen} listing={{
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zip_code: listing.zip_code,
        price: listing.price,
        property_type: listing.property_type
      }} />
      </Card>;
  }

  // Grid view
  return <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative aspect-[4/3]">
        {photoUrl ? <img src={photoUrl} alt={listing.address} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center">
            <Home className="w-12 h-12 text-muted-foreground" />
          </div>}
        
        {/* Status Change Banner (top priority) */}
        {statusBanner && <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-sm font-bold px-3 py-2 text-center flex items-center justify-center gap-2`}>
            {statusBanner.iconType === 'sparkles' ? <Sparkles className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            {statusBanner.text}
          </div>}
        
        {/* Open House Banner (secondary priority, positioned below status banner if both exist) */}
        {openHouseBanner && <div className={`absolute ${statusBanner ? 'top-10' : 'top-0'} left-0 right-0 ${openHouseBanner.color} text-white text-sm font-bold px-3 py-2 text-center`}>
            {openHouseBanner.isBroker ? '🏢' : '🎈'} {openHouseBanner.text} - {openHouseBanner.date}
          </div>}
        
        {/* Photo count badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {listing.photos?.length || 0} Photos
        </div>
      </div>
      <CardContent className="p-3">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="text-base font-semibold mb-1">
              {listing.address}
              {unitNumber && <Badge variant="secondary" className="ml-2 text-xs">
                  Unit {unitNumber}
                </Badge>}
            </h3>
            <div className="flex items-center text-muted-foreground text-xs mb-1.5">
              <MapPin className="w-3 h-3 mr-1" />
              {listing.city}, {listing.state} {listing.zip_code}
            </div>
            <div className="flex flex-col gap-0.5">
              {listing.listing_number && <div className="text-xs text-muted-foreground">
                  Listing #{listing.listing_number}
                </div>}
              <div className="flex flex-wrap items-center gap-1">
                {listing.is_relisting && <Badge variant="secondary" className="text-xs">
                    Relisted - History Preserved
                  </Badge>}
                {daysOnMarket > 0 && <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {daysOnMarket} {daysOnMarket === 1 ? 'day' : 'days'}
                  </Badge>}
                {listing.listing_stats?.cumulative_active_days && listing.listing_stats.cumulative_active_days > daysOnMarket && <Badge variant="secondary" className="text-xs">
                    {listing.listing_stats.cumulative_active_days} total
                  </Badge>}
              </div>
            </div>
          </div>
          <Badge variant={listing.status === "active" ? "default" : "secondary"} className="text-xs">
            {listing.status}
          </Badge>
        </div>

        <div className="text-lg font-bold text-primary mb-2">
          {formatPrice(listing.price)}
        </div>

        <div className="flex gap-3 mb-2 text-xs text-muted-foreground">
          {listing.bedrooms && <div className="flex items-center">
              <Bed className="w-4 h-4 mr-1" />
              {listing.bedrooms} beds
            </div>}
          {listing.bathrooms && <div className="flex items-center">
              <Bath className="w-4 h-4 mr-1" />
              {listing.bathrooms} baths
            </div>}
          {listing.square_feet && <div className="flex items-center">
              <Home className="w-4 h-4 mr-1" />
              {listing.square_feet.toLocaleString()} sqft
            </div>}
        </div>

        {listing.status === 'active' && <Button size="sm" variant={matchButtonStyle.variant} onClick={() => setProspectDialogOpen(true)} disabled={matchCount === 0 || loadingMatches} className={`mb-2 w-full text-xs h-7 ${matchButtonStyle.className}`}>
            <Users className="w-3 h-3 mr-1" />
            {loadingMatches ? "Loading..." : matchCount > 0 ? `${matchCount} matches` : "0 matches"}
          </Button>}

        {/* Listing Stats */}
        {listing.listing_stats && <div className="grid grid-cols-2 gap-1.5 mb-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1 p-1.5 rounded bg-muted/50">
              <Eye className="w-3 h-3" />
              <span>{listing.listing_stats.view_count}</span>
            </div>
            <div className="flex items-center gap-1 p-1.5 rounded bg-muted/50">
              <Heart className="w-3 h-3" />
              <span>{listing.listing_stats.save_count}</span>
            </div>
            <div className="flex items-center gap-1 p-1.5 rounded bg-muted/50">
              <Mail className="w-3 h-3" />
              <span>{listing.listing_stats.contact_count}</span>
            </div>
            <div className="flex items-center gap-1 p-1.5 rounded bg-muted/50">
              <Calendar className="w-3 h-3" />
              <span>{listing.listing_stats.showing_request_count}</span>
            </div>
          </div>}

        {listing.property_type && <Badge variant="outline" className="mb-2 text-xs">
            {listing.property_type}
          </Badge>}

        <div className="flex gap-1.5 mt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => {
            sessionStorage.setItem('fromAgentDashboard', 'true');
            navigate(`/property/${listing.id}`);
          }}>
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/analytics/${listing.id}`)}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Stats
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={e => {
          e.stopPropagation();
          setMarketInsightsOpen(true);
        }}>
            <TrendingDown className="w-4 h-4 mr-2" />
            Market
          </Button>
          <Button variant="default" size="sm" className="flex-1" onClick={() => navigate(`/edit-listing/${listing.id}`)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          {listing.status === 'cancelled' && onReactivate && <Button variant="default" size="sm" onClick={() => onReactivate(listing.id)} className="bg-green-600 hover:bg-green-700">
              <RefreshCw className="w-4 h-4 mr-1" />
              Reactivate
            </Button>}
        </div>
      </CardContent>
      <ReverseProspectDialog open={prospectDialogOpen} onOpenChange={setProspectDialogOpen} listing={listing} matchCount={matchCount} />
      <MarketInsightsDialog open={marketInsightsOpen} onOpenChange={setMarketInsightsOpen} listing={{
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zip_code: listing.zip_code,
      price: listing.price,
      property_type: listing.property_type
    }} />
    </Card>;
};
export default ListingCard;