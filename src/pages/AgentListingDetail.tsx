import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Calendar,
  Phone,
  Mail,
  Share2,
  Eye,
  EyeOff,
  Home,
  FileText,
  ChevronLeft,
  ChevronRight,
  Video,
  Globe,
  Maximize2,
  Edit,
  Send,
  Thermometer,
  Car,
  Clock,
  DollarSign,
  Building2,
  Info,
  Flame
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { buildDisplayAddress } from "@/lib/utils";
import { useListingView } from "@/hooks/useListingView";
import PhotoGalleryDialog from "@/components/PhotoGalleryDialog";
import SocialShareMenu from "@/components/SocialShareMenu";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";

interface Listing {
  id: string;
  agent_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  county?: string | null;
  neighborhood?: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  lot_size: number | null;
  year_built: number | null;
  price: number;
  description: string | null;
  status: string;
  listing_type: string;
  photos: any[] | null;
  floor_plans?: any[] | null;
  listing_number?: string | null;
  created_at?: string;
  active_date?: string | null;
  list_date?: string | null;
  expiration_date?: string | null;
  video_url?: string | null;
  virtual_tour_url?: string | null;
  property_website_url?: string | null;
  commission_rate?: number | null;
  commission_type?: string | null;
  commission_notes?: string | null;
  heating_types?: any[] | null;
  cooling_types?: any[] | null;
  total_parking_spaces?: number | null;
  garage_spaces?: number | null;
  property_features?: any[] | null;
  amenities?: any[] | null;
  exterior_features_list?: any[] | null;
  basement_types?: any[] | null;
  has_basement?: boolean;
  foundation_types?: any[] | null;
  roof_materials?: any[] | null;
  construction_features?: any[] | null;
  floors?: number | null;
  num_fireplaces?: number | null;
  laundry_type?: string | null;
  waterfront?: boolean;
  water_view?: boolean;
  beach_nearby?: boolean;
  annual_property_tax?: number | null;
  tax_year?: number | null;
  assessed_value?: number | null;
  disclosures?: any[] | null;
  disclosures_other?: string | null;
  lead_paint?: string | null;
  showing_instructions?: string | null;
  lockbox_code?: string | null;
  appointment_required?: boolean;
  showing_contact_name?: string | null;
  showing_contact_phone?: string | null;
  broker_comments?: string | null;
  additional_notes?: string | null;
  condo_details?: any;
  multi_family_details?: any;
  unit_number?: string | null;
  building_name?: string | null;
}

interface AgentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_phone?: string;
  phone?: string;
  title?: string;
  company?: string;
  office_name?: string;
  office_phone?: string;
  office_address?: string;
  office_city?: string;
  office_state?: string;
  office_zip?: string;
  headshot_url?: string;
  logo_url?: string;
}

const AgentListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [stats, setStats] = useState({ matches: 0, views: 0 });
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  
  // Agent vs Client view toggle - agents default to agent view
  const [viewAsClient, setViewAsClient] = useState(false);
  const isAgentView = !viewAsClient;

  useListingView(id);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const { data, error } = await supabase
          .from("listings")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setListing({
            ...data,
            photos: Array.isArray(data.photos) ? data.photos as any[] : [],
            floor_plans: Array.isArray(data.floor_plans) ? data.floor_plans as any[] : [],
          } as Listing);

          if (data.agent_id) {
            const { data: profile } = await supabase
              .from("agent_profiles")
              .select("*")
              .eq("id", data.agent_id)
              .maybeSingle();

            if (profile) {
              setAgentProfile(profile);
            }
          }

          const { data: statsData } = await supabase
            .from("listing_stats")
            .select("view_count")
            .eq("listing_id", data.id)
            .maybeSingle();

          const { count: matchCount } = await supabase
            .from("hot_sheets")
            .select("*", { count: "exact", head: true })
            .contains("criteria", { city: [data.city] });

          setStats({
            matches: matchCount || 0,
            views: statsData?.view_count || 0,
          });

          // Fetch price history
          const { data: historyData } = await supabase
            .from("listing_price_history")
            .select("*")
            .eq("listing_id", data.id)
            .order("changed_at", { ascending: false });

          if (historyData) {
            setPriceHistory(historyData);
          }
        }
      } catch (error: any) {
        console.error("Error fetching listing:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchListing();
    }
  }, [id]);

  const handleCopyLink = async () => {
    const shareUrl = getListingShareUrl(id!);
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
    
    const { trackShare } = await import("@/lib/trackShare");
    await trackShare(id!, 'copy_link');
  };

  const handlePrevPhoto = () => {
    if (listing?.photos && listing.photos.length > 0) {
      setCurrentPhotoIndex((prev) => 
        prev === 0 ? listing.photos!.length - 1 : prev - 1
      );
    }
  };

  const handleNextPhoto = () => {
    if (listing?.photos && listing.photos.length > 0) {
      setCurrentPhotoIndex((prev) => 
        prev === listing.photos!.length - 1 ? 0 : prev + 1
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'new':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30';
      case 'coming_soon':
        return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
      case 'pending':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
      case 'sold':
        return 'bg-purple-500/10 text-purple-700 border-purple-500/30';
      case 'off_market':
        return 'bg-rose-500/10 text-rose-700 border-rose-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPhotoUrl = (photo: any): string => {
    if (typeof photo === 'string') return photo;
    return photo?.url || '/placeholder.svg';
  };

  const formatArray = (arr: any[] | null | undefined) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    const items = arr.map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.name || item.label || item.value || JSON.stringify(item);
      }
      return String(item);
    });
    return [...new Set(items)].join(', ');
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 mt-20">
          <Card className="bg-card border-border rounded-xl shadow-sm">
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Listing not found</p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => navigate("/agent/listings")}>Back to My Listings</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const mainPhoto = listing.photos && listing.photos.length > 0 
    ? getPhotoUrl(listing.photos[currentPhotoIndex])
    : '/placeholder.svg';

  const listDate = listing.list_date || listing.active_date || listing.created_at;
  const daysOnMarket = listDate 
    ? Math.ceil((new Date().getTime() - new Date(listDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const displayAddress = listing.unit_number 
    ? `${listing.address} #${listing.unit_number}`
    : listing.address;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Sticky Header Bar */}
      <div className="border-b border-border bg-card sticky top-16 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const fromPage = location.state?.from;
                if (fromPage) {
                  navigate(fromPage);
                } else if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/agent/listings");
                }
              }}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {/* Agent-only action buttons */}
              {isAgentView && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/agent/listings/edit/${id}`)}
                    className="gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Listing
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`/property/${id}`, '_blank')}
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </Button>
                  <SocialShareMenu
                    url={getListingShareUrl(id!)}
                    title={`${displayAddress}, ${listing.city}, ${listing.state}`}
                    description={listing.description || ''}
                    listingId={id!}
                  />
                  <Button 
                    size="sm"
                    className="gap-2 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600"
                  >
                    <Send className="w-4 h-4" />
                    Send to Agents
                  </Button>
                </>
              )}
              
              {/* Agent View / Client View toggle */}
              <button
                type="button"
                onClick={() => setViewAsClient((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
              >
                {viewAsClient ? (
                  <>
                    <Eye className="h-4 w-4" />
                    Agent View
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Client View
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Summary Card */}
        <Card className="bg-card border-border rounded-xl shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={`${getStatusColor(listing.status)} text-sm font-medium px-3 py-1`}>
                    {formatStatus(listing.status)}
                  </Badge>
                  {listing.listing_number && (
                    <Badge variant="outline" className="font-mono text-xs">
                      AAC #{listing.listing_number}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {listing.listing_type === 'for_rent' ? 'For Rent' : 'For Sale'}
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-1">{displayAddress}</h1>
                <p className="text-muted-foreground">
                  {listing.city}, {listing.state} {listing.zip_code}
                  {listing.county && ` • ${listing.county} County`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-foreground">
                  ${listing.price.toLocaleString()}
                  {listing.listing_type === 'for_rent' && <span className="text-lg text-muted-foreground">/mo</span>}
                </p>
                {listing.property_type && (
                  <p className="text-sm text-muted-foreground mt-1">{listing.property_type}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground justify-end">
                  {listDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Listed {new Date(listDate).toLocaleDateString()}
                    </span>
                  )}
                  {listing.expiration_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Expires {new Date(listing.expiration_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photo Gallery */}
        <Card className="bg-card border-border rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="relative aspect-[16/9] bg-muted">
            <img
              src={mainPhoto}
              alt={listing.address}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setGalleryOpen(true)}
            />
            
            {/* Photo Controls */}
            {listing.photos && listing.photos.length > 1 && (
              <>
                <button
                  onClick={handlePrevPhoto}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground p-2.5 rounded-full transition-all shadow-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNextPhoto}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground p-2.5 rounded-full transition-all shadow-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-4 left-4 bg-background/80 text-foreground px-3 py-1.5 rounded-full text-sm font-medium shadow-lg">
                  {currentPhotoIndex + 1} / {listing.photos.length}
                </div>
              </>
            )}
            
            <button
              onClick={() => setGalleryOpen(true)}
              className="absolute bottom-4 right-4 bg-background/80 hover:bg-background text-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 transition-all"
            >
              <Maximize2 className="w-4 h-4" />
              View All Photos
            </button>
          </div>
          
          {/* Thumbnail Strip */}
          {listing.photos && listing.photos.length > 1 && (
            <div className="p-3 bg-muted/30 border-t border-border">
              <div className="flex gap-2 overflow-x-auto">
                {listing.photos.slice(0, 8).map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPhotoIndex(index)}
                    className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      currentPhotoIndex === index 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    <img
                      src={getPhotoUrl(photo)}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
                {listing.photos.length > 8 && (
                  <button
                    onClick={() => setGalleryOpen(true)}
                    className="flex-shrink-0 w-20 h-14 rounded-lg bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-all"
                  >
                    +{listing.photos.length - 8}
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Quick Facts Grid */}
        <Card className="bg-card border-border rounded-xl shadow-sm mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Home className="w-5 h-5 text-muted-foreground" />
              Quick Facts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {listing.bedrooms !== null && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Bed className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">{listing.bedrooms}</p>
                  <p className="text-xs text-muted-foreground">Bedrooms</p>
                </div>
              )}
              {listing.bathrooms !== null && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Bath className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">{listing.bathrooms}</p>
                  <p className="text-xs text-muted-foreground">Bathrooms</p>
                </div>
              )}
              {listing.square_feet !== null && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Square className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">{listing.square_feet.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Sq Ft</p>
                </div>
              )}
              {listing.lot_size !== null && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <MapPin className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">{listing.lot_size}</p>
                  <p className="text-xs text-muted-foreground">Acres</p>
                </div>
              )}
              {(listing.total_parking_spaces || listing.garage_spaces) && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Car className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {listing.total_parking_spaces || listing.garage_spaces}
                  </p>
                  <p className="text-xs text-muted-foreground">Parking</p>
                </div>
              )}
              {listing.year_built !== null && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Calendar className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">{listing.year_built}</p>
                  <p className="text-xs text-muted-foreground">Year Built</p>
                </div>
              )}
            </div>
            
            {/* Additional Quick Facts Row */}
            {(listing.heating_types || listing.cooling_types) && (
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-3">
                {listing.heating_types && formatArray(listing.heating_types) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-muted-foreground">Heating:</span>
                    <span className="font-medium">{formatArray(listing.heating_types)}</span>
                  </div>
                )}
                {listing.cooling_types && formatArray(listing.cooling_types) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Thermometer className="w-4 h-4 text-blue-500" />
                    <span className="text-muted-foreground">Cooling:</span>
                    <span className="font-medium">{formatArray(listing.cooling_types)}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Full Description */}
            {listing.description && (
              <Card className="bg-card border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {listing.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Property Information */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  Property Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                  <DetailRow label="Property Type" value={listing.property_type} />
                  <DetailRow label="Living Area" value={listing.square_feet ? `${listing.square_feet.toLocaleString()} sq ft` : null} />
                  <DetailRow label="Lot Size" value={listing.lot_size ? `${listing.lot_size} acres` : null} />
                  <DetailRow label="Year Built" value={listing.year_built} />
                  <DetailRow label="Stories" value={listing.floors} />
                  <DetailRow label="Bedrooms" value={listing.bedrooms} />
                  <DetailRow label="Bathrooms" value={listing.bathrooms} />
                  <DetailRow label="Garage Spaces" value={listing.garage_spaces} />
                  <DetailRow label="Fireplaces" value={listing.num_fireplaces} />
                  <DetailRow label="Laundry" value={listing.laundry_type} />
                  {listing.unit_number && <DetailRow label="Unit Number" value={listing.unit_number} />}
                  {listing.building_name && <DetailRow label="Building Name" value={listing.building_name} />}
                </div>

                {/* Features & Amenities */}
                {(listing.property_features || listing.amenities || listing.exterior_features_list) && (
                  <div className="mt-6 pt-4 border-t border-border space-y-4">
                    {formatArray([...(listing.property_features || []), ...(listing.amenities || [])]) && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Interior Features</p>
                        <p className="text-sm text-foreground">
                          {formatArray([...(listing.property_features || []), ...(listing.amenities || [])])}
                        </p>
                      </div>
                    )}
                    {listing.exterior_features_list && formatArray(listing.exterior_features_list) && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Exterior Features</p>
                        <p className="text-sm text-foreground">{formatArray(listing.exterior_features_list)}</p>
                      </div>
                    )}
                    {listing.basement_types && formatArray(listing.basement_types) && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Basement</p>
                        <p className="text-sm text-foreground">{formatArray(listing.basement_types)}</p>
                      </div>
                    )}
                    {listing.foundation_types && formatArray(listing.foundation_types) && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Foundation</p>
                        <p className="text-sm text-foreground">{formatArray(listing.foundation_types)}</p>
                      </div>
                    )}
                    {listing.roof_materials && formatArray(listing.roof_materials) && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Roof</p>
                        <p className="text-sm text-foreground">{formatArray(listing.roof_materials)}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Utilities */}
                {(listing.heating_types || listing.cooling_types) && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Utilities</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                      {listing.heating_types && formatArray(listing.heating_types) && (
                        <DetailRow label="Heating" value={formatArray(listing.heating_types)} />
                      )}
                      {listing.cooling_types && formatArray(listing.cooling_types) && (
                        <DetailRow label="Cooling" value={formatArray(listing.cooling_types)} />
                      )}
                    </div>
                  </div>
                )}

                {/* Water Features */}
                {(listing.waterfront || listing.water_view || listing.beach_nearby) && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Water Features</p>
                    <div className="flex flex-wrap gap-2">
                      {listing.waterfront && <Badge variant="secondary">Waterfront</Badge>}
                      {listing.water_view && <Badge variant="secondary">Water View</Badge>}
                      {listing.beach_nearby && <Badge variant="secondary">Beach Nearby</Badge>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Disclosures */}
            {(listing.disclosures || listing.disclosures_other || listing.lead_paint) && (
              <Card className="bg-card border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Info className="w-5 h-5 text-muted-foreground" />
                    Disclosures
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {listing.disclosures && formatArray(listing.disclosures) && (
                    <p className="text-sm text-foreground">{formatArray(listing.disclosures)}</p>
                  )}
                  {listing.disclosures_other && (
                    <p className="text-sm text-foreground">{listing.disclosures_other}</p>
                  )}
                  {listing.lead_paint && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Lead Paint:</span>
                      <span className="text-sm font-medium">{listing.lead_paint}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Market History - Agent Only */}
            {isAgentView && (
              <Card className="bg-card border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    Market History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {listDate && (
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">List Date</p>
                        <p className="font-semibold">{new Date(listDate).toLocaleDateString()}</p>
                      </div>
                    )}
                    {daysOnMarket !== null && (
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Days on Market</p>
                        <p className="font-semibold">{daysOnMarket}</p>
                      </div>
                    )}
                    {listing.expiration_date && (
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Expiration</p>
                        <p className="font-semibold">{new Date(listing.expiration_date).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Price History */}
                  {priceHistory.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Price Changes</p>
                      <div className="space-y-2">
                        {priceHistory.map((change, index) => (
                          <div key={change.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                            <span className="text-muted-foreground">
                              {new Date(change.changed_at).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-3">
                              {change.old_price && (
                                <span className="text-muted-foreground line-through">
                                  ${change.old_price.toLocaleString()}
                                </span>
                              )}
                              <span className="font-medium text-foreground">
                                ${change.new_price.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Tax Information */}
            {(listing.annual_property_tax || listing.assessed_value) && (
              <Card className="bg-card border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                    Tax Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {listing.annual_property_tax && (
                    <DetailRow label="Annual Tax" value={`$${listing.annual_property_tax.toLocaleString()}`} />
                  )}
                  {listing.tax_year && (
                    <DetailRow label="Tax Year" value={listing.tax_year} />
                  )}
                  {listing.assessed_value && (
                    <DetailRow label="Assessed Value" value={`$${listing.assessed_value.toLocaleString()}`} />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Agent & Office Information */}
            {agentProfile && (
              <Card className="bg-card border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Listing Agent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-12 h-12">
                      {agentProfile.headshot_url ? (
                        <AvatarImage src={agentProfile.headshot_url} />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {agentProfile.first_name[0]}{agentProfile.last_name[0]}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">
                        {agentProfile.first_name} {agentProfile.last_name}
                      </p>
                      {agentProfile.title && (
                        <p className="text-sm text-muted-foreground">{agentProfile.title}</p>
                      )}
                      {(agentProfile.company || agentProfile.office_name) && (
                        <p className="text-sm text-muted-foreground">
                          {agentProfile.company || agentProfile.office_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    {(agentProfile.cell_phone || agentProfile.phone) && (
                      <a
                        href={`tel:${agentProfile.cell_phone || agentProfile.phone}`}
                        className="flex items-center gap-3 text-sm hover:text-primary transition"
                      >
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{formatPhoneNumber(agentProfile.cell_phone || agentProfile.phone)}</span>
                      </a>
                    )}
                    {agentProfile.email && (
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="break-all">{agentProfile.email}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Buyer Agent Compensation - Agent Only */}
            {isAgentView && (listing.commission_rate || listing.commission_notes) && (
              <Card className="bg-card border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                    Buyer Agent Compensation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {listing.commission_rate && listing.commission_type && (
                    <p className="text-xl font-bold text-foreground mb-2">
                      {listing.commission_type === 'percentage' 
                        ? `${listing.commission_rate}%`
                        : `$${listing.commission_rate.toLocaleString()}`
                      }
                    </p>
                  )}
                  {listing.commission_notes && (
                    <p className="text-sm text-muted-foreground">{listing.commission_notes}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Showing Instructions - Agent Only */}
            {isAgentView && (
              <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50 rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2 text-blue-900 dark:text-blue-100">
                      <Info className="w-5 h-5" />
                      Showing Instructions
                    </CardTitle>
                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-300">
                      Agent Only
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <DetailRow 
                    label="Appointment Required" 
                    value={listing.appointment_required ? 'Yes' : 'No'} 
                  />
                  {listing.lockbox_code && (
                    <DetailRow label="Lockbox Code" value={listing.lockbox_code} />
                  )}
                  {listing.showing_contact_name && (
                    <DetailRow label="Contact Name" value={listing.showing_contact_name} />
                  )}
                  {listing.showing_contact_phone && (
                    <DetailRow label="Contact Phone" value={formatPhoneNumber(listing.showing_contact_phone)} />
                  )}
                  {listing.showing_instructions && (
                    <div className="pt-2 mt-2 border-t border-blue-200/50">
                      <p className="text-sm text-muted-foreground mb-1">Instructions:</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{listing.showing_instructions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Broker Remarks - Agent Only */}
            {isAgentView && listing.broker_comments && (
              <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/50 rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2 text-amber-900 dark:text-amber-100">
                      <FileText className="w-5 h-5" />
                      Broker Remarks
                    </CardTitle>
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-300">
                      Agent Only
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{listing.broker_comments}</p>
                </CardContent>
              </Card>
            )}

            {/* Additional Notes */}
            {listing.additional_notes && (
              <Card className="bg-card border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Additional Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{listing.additional_notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Full Photo Grid Gallery */}
        {listing.photos && listing.photos.length > 1 && (
          <Card className="bg-card border-border rounded-xl shadow-sm mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">All Photos ({listing.photos.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {listing.photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentPhotoIndex(index);
                      setGalleryOpen(true);
                    }}
                    className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                  >
                    <img
                      src={getPhotoUrl(photo)}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Photo Gallery Dialog */}
      <PhotoGalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        photos={listing.photos || []}
        floorPlans={listing.floor_plans || []}
        videos={listing.video_url ? [listing.video_url] : []}
        virtualTours={listing.virtual_tour_url ? [listing.virtual_tour_url] : []}
        initialIndex={currentPhotoIndex}
      />
    </div>
  );
};

// Helper component for detail rows
const DetailRow = ({ label, value }: { label: string; value: any }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
};

export default AgentListingDetail;
