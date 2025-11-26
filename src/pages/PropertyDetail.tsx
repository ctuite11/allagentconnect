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
  Home,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { buildDisplayAddress } from "@/lib/utils";
import { useListingView } from "@/hooks/useListingView";
import { PropertyMetaTags } from "@/components/PropertyMetaTags";
import { ListingDetailSections } from "@/components/ListingDetailSections";

interface Listing {
  id: string;
  agent_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
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
  listing_number?: string | null;
  created_at?: string;
  active_date?: string | null;
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
  headshot_url?: string;
  logo_url?: string;
}

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [stats, setStats] = useState({ matches: 0, views: 0 });

  // Track listing view
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
          } as Listing);

          // Fetch agent profile
          if (data.agent_id) {
            const { data: profile } = await supabase
              .from("agent_profiles")
              .select("id, first_name, last_name, email, cell_phone, phone, title, company, headshot_url, logo_url")
              .eq("id", data.agent_id)
              .maybeSingle();

            if (profile) {
              setAgentProfile(profile);
            }
          }

          // Fetch stats
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'sold':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'cancelled':
      case 'expired':
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 mt-20">
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Listing not found</p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => navigate("/")}>Back to Home</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Helper to handle both string and object photo formats
  const getPhotoUrl = (photo: any): string => {
    if (typeof photo === 'string') return photo;
    return photo?.url || '/placeholder.svg';
  };

  const mainPhoto = listing.photos && listing.photos.length > 0 
    ? getPhotoUrl(listing.photos[currentPhotoIndex])
    : '/placeholder.svg';

  const canonicalUrl = `${window.location.origin}/property/${id}`;
  const listDate = listing.active_date || listing.created_at;
  const daysOnMarket = listDate 
    ? Math.ceil((new Date().getTime() - new Date(listDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-background">
      <PropertyMetaTags
        address={listing.address}
        city={listing.city}
        state={listing.state}
        price={listing.price}
        bedrooms={listing.bedrooms}
        bathrooms={listing.bathrooms}
        description={listing.description}
        photo={mainPhoto}
        listingType={listing.listing_type}
        url={canonicalUrl}
      />
      
      <Navigation />

      {/* Compact Header Bar */}
      <div className="border-b bg-card sticky top-16 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {listing.listing_number && (
                <Badge variant="outline" className="font-mono text-xs">
                  AAC #{listing.listing_number}
                </Badge>
              )}
              <Badge className={getStatusColor(listing.status)}>
                {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photos & Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Photo */}
            <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-muted">
              <img
                src={mainPhoto}
                alt={listing.address}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Thumbnail Strip */}
            {listing.photos && listing.photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {listing.photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPhotoIndex(index)}
                    className={`relative flex-shrink-0 w-24 h-16 rounded overflow-hidden border-2 transition ${
                      index === currentPhotoIndex
                        ? 'border-primary'
                        : 'border-transparent hover:border-border'
                    }`}
                  >
                    <img
                      src={getPhotoUrl(photo)}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Address & Price */}
            <div>
              <div className="flex items-start gap-2 mb-2">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">{listing.address}</h1>
                  <p className="text-muted-foreground">
                    {listing.city}, {listing.state} {listing.zip_code}
                  </p>
                </div>
              </div>
              <div className="text-3xl font-bold text-primary">
                ${listing.price.toLocaleString()}
                {listing.listing_type === 'for_rent' && (
                  <span className="text-lg text-muted-foreground">/month</span>
                )}
              </div>
            </div>

            {/* Key Stats Row */}
            <div className="flex flex-wrap items-center gap-6 py-4 border-y">
              {listing.bedrooms && (
                <div className="flex items-center gap-2">
                  <Bed className="w-5 h-5 text-muted-foreground" />
                  <span className="font-semibold">{listing.bedrooms}</span>
                  <span className="text-muted-foreground text-sm">Beds</span>
                </div>
              )}
              {listing.bathrooms && (
                <div className="flex items-center gap-2">
                  <Bath className="w-5 h-5 text-muted-foreground" />
                  <span className="font-semibold">{listing.bathrooms}</span>
                  <span className="text-muted-foreground text-sm">Baths</span>
                </div>
              )}
              {listing.square_feet && (
                <div className="flex items-center gap-2">
                  <Square className="w-5 h-5 text-muted-foreground" />
                  <span className="font-semibold">{listing.square_feet.toLocaleString()}</span>
                  <span className="text-muted-foreground text-sm">Sq Ft</span>
                </div>
              )}
            </div>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-foreground/80 font-medium">
              {listDate && (
                <div>
                  <span className="text-muted-foreground">List:</span>{' '}
                  {new Date(listDate).toLocaleDateString()}
                </div>
              )}
              {daysOnMarket && (
                <div>
                  <span className="text-muted-foreground">Days on Market:</span>{' '}
                  {daysOnMarket}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Matches:</span> {stats.matches}
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                <span>{stats.views}</span>
              </div>
            </div>

            {/* Overview/Description */}
            {listing.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {listing.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* MLS-Style Detail Sections */}
            <ListingDetailSections 
              listing={listing} 
              agent={agentProfile}
              isAgentView={true}
            />
          </div>

          {/* Right Column - Agent Card & Key Facts */}
          <div className="space-y-6">
            {/* Agent Contact Card */}
            {agentProfile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Listing Agent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-12 h-12">
                      {agentProfile.headshot_url ? (
                        <AvatarImage src={agentProfile.headshot_url} />
                      ) : (
                        <AvatarFallback>
                          {agentProfile.first_name[0]}{agentProfile.last_name[0]}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">
                        {agentProfile.first_name} {agentProfile.last_name}
                      </p>
                      {agentProfile.title && (
                        <p className="text-sm text-muted-foreground">{agentProfile.title}</p>
                      )}
                      {agentProfile.company && (
                        <p className="text-sm text-muted-foreground">{agentProfile.company}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Contact the listing agent directly for more information or to schedule a showing.
                  </p>

                  <Separator />

                  <div className="space-y-3">
                    {(agentProfile.cell_phone || agentProfile.phone) && (
                      <a
                        href={`tel:${agentProfile.cell_phone || agentProfile.phone}`}
                        className="flex items-center gap-3 text-sm hover:text-primary transition"
                      >
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {formatPhoneNumber(agentProfile.cell_phone || agentProfile.phone)}
                        </span>
                      </a>
                    )}
                    {agentProfile.email && (
                      <a
                        href={`mailto:${agentProfile.email}`}
                        className="flex items-center gap-3 text-sm hover:text-primary transition break-all"
                      >
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{agentProfile.email}</span>
                      </a>
                    )}
                  </div>

                  <Button className="w-full" size="lg">
                    Ask about this property
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Key Facts Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Facts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">
                    {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                  </span>
                </div>
                {listing.listing_number && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">AAC #</span>
                    <span className="font-medium font-mono">{listing.listing_number}</span>
                  </div>
                )}
                {listDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Listed</span>
                    <span className="font-medium">
                      {new Date(listDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {listing.year_built && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Year Built</span>
                    <span className="font-medium">{listing.year_built}</span>
                  </div>
                )}
                {listing.property_type && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Property Type</span>
                    <span className="font-medium">{listing.property_type}</span>
                  </div>
                )}
                {listing.lot_size && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lot Size</span>
                    <span className="font-medium">{listing.lot_size} acres</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;
