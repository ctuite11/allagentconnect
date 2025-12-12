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
  Expand,
  Edit2,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { buildDisplayAddress } from "@/lib/utils";
import { useListingView } from "@/hooks/useListingView";
import { useAuthRole } from "@/hooks/useAuthRole";
import { PropertyMetaTags } from "@/components/PropertyMetaTags";
import { ListingDetailSections } from "@/components/ListingDetailSections";
import { PropertyDetailRightColumn } from "@/components/PropertyDetailRightColumn";
import ContactAgentDialog from "@/components/ContactAgentDialog";
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
  video_url?: string | null;
  virtual_tour_url?: string | null;
  property_website_url?: string | null;
  commission_rate?: number | null;
  commission_type?: string | null;
  commission_notes?: string | null;
  broker_comments?: string | null;
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
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'photos' | 'video' | 'tour' | 'website'>('photos');
  
  // Role detection for dual-view
  const { user, role, loading: roleLoading } = useAuthRole();
  const isAgent = role === "agent";
  const [viewAsClient, setViewAsClient] = useState(false);
  const isAgentView = isAgent && !viewAsClient;

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

  const handleShare = async () => {
    const shareUrl = getListingShareUrl(id!);
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing?.address || 'Property Listing',
          text: `Check out this property: ${listing?.address}`,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled, do nothing
      }
    } else {
      // Fallback to copy if share not available
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = getListingShareUrl(id!);
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
    
    // Track the share
    const { trackShare } = await import("@/lib/trackShare");
    await trackShare(id!, 'copy_link');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExpandGallery = () => {
    setGalleryOpen(true);
  };

  const handleMediaTabChange = (tab: 'photos' | 'video' | 'tour' | 'website') => {
    setActiveMediaTab(tab);
    if (tab === 'photos') {
      setCurrentPhotoIndex(0);
    }
  };

  const handlePrevPhoto = () => {
    if (listing?.photos && listing.photos.length > 0) {
      setCurrentPhotoIndex((prev) => 
        prev === 0 ? listing.photos.length - 1 : prev - 1
      );
    }
  };

  const handleNextPhoto = () => {
    if (listing?.photos && listing.photos.length > 0) {
      setCurrentPhotoIndex((prev) => 
        prev === listing.photos.length - 1 ? 0 : prev + 1
      );
    }
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

  const canonicalUrl = getListingPublicUrl(id!);
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
        listingId={id!}
      />
      
      <Navigation />

      {/* Compact Header Bar */}
      <div className="border-b bg-card sticky top-16 z-10">
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
                  navigate("/listing-search");
                }
              }}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {/* Agent-only buttons */}
              {isAgentView && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/agent/listings/edit/${id}`)}
                    className="gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Listing
                  </Button>
                </>
              )}

              {/* Agent View / Client View Toggle */}
              {isAgent && (
                <button
                  type="button"
                  onClick={() => setViewAsClient((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
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
              )}

              <SocialShareMenu
                url={getListingShareUrl(id!)}
                title={`${listing.address}, ${listing.city}, ${listing.state}`}
                description={listing.description || ''}
                listingId={id!}
              />
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 pt-20">
        {/* Agent/Client View Banner */}
        {isAgent && (
          <div className="container mx-auto px-4 pt-4" style={{ maxWidth: '1600px' }}>
            <div className={`rounded-lg px-4 py-2.5 text-sm ${
              isAgentView 
                ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 border border-sky-200 dark:border-sky-800' 
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
            }`}>
              {isAgentView ? (
                <>
                  <strong>Agent View</strong> – includes broker-only information (compensation, showing instructions, broker remarks). Switch to Client View before screen-sharing with clients.
                </>
              ) : (
                <>
                  <strong>Client View</strong> – you're viewing this listing as a consumer would. Broker-only information is hidden.
                </>
              )}
            </div>
          </div>
        )}

        {/* Hero Section - Max Width 1600px */}
        <div className="container mx-auto px-4 py-6" style={{ maxWidth: '1600px' }}>
          {/* Hero Photo Card with Overlays */}
          <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-muted mx-auto shadow-lg">
            {/* Media Content */}
            {activeMediaTab === 'photos' && (
              <img
                src={mainPhoto}
                alt={listing.address}
                className="w-full h-full object-cover cursor-pointer"
                onClick={handleExpandGallery}
              />
            )}
            {activeMediaTab === 'video' && listing.video_url && (
              <iframe
                src={listing.video_url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
            {activeMediaTab === 'tour' && listing.virtual_tour_url && (
              <iframe
                src={listing.virtual_tour_url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
            {activeMediaTab === 'website' && listing.property_website_url && (
              <iframe
                src={listing.property_website_url}
                className="w-full h-full"
              />
            )}
            
            {/* Status Badge & AAC ID - Top Left Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              {listing.listing_number && (
                <Badge variant="outline" className="font-mono text-xs bg-white/90 backdrop-blur-sm">
                  AAC #{listing.listing_number}
                </Badge>
              )}
              <Badge className={`${getStatusColor(listing.status)} bg-white/90 backdrop-blur-sm`}>
                {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
              </Badge>
            </div>

            {/* Share Button - Top Right Overlay */}
            <button
              onClick={handleCopyLink}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all backdrop-blur-sm"
              aria-label="Share property"
            >
              <Share2 className="w-5 h-5" />
            </button>
            
            {/* Carousel Arrow Controls - Only for Photos */}
            {activeMediaTab === 'photos' && listing.photos && listing.photos.length > 1 && (
              <>
                <button
                  onClick={handlePrevPhoto}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNextPhoto}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
            
            {/* Photo Counter - Bottom Left Overlay */}
            {activeMediaTab === 'photos' && listing.photos && listing.photos.length > 0 && (
              <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                {currentPhotoIndex + 1} / {listing.photos.length}
              </div>
            )}
          </div>

          {/* Media Type Tabs - Below Photo Card */}
          <div className="flex items-center gap-2 mt-4 mx-auto">
            <Button
              variant={activeMediaTab === 'photos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleMediaTabChange('photos')}
              className="rounded-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Photos
            </Button>
            {listing.video_url && (
              <Button
                variant={activeMediaTab === 'video' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMediaTabChange('video')}
                className="rounded-full"
              >
                <Video className="w-4 h-4 mr-2" />
                Video
              </Button>
            )}
            {listing.virtual_tour_url && (
              <Button
                variant={activeMediaTab === 'tour' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMediaTabChange('tour')}
                className="rounded-full"
              >
                <Maximize2 className="w-4 h-4 mr-2" />
                3D Tour
              </Button>
            )}
            {listing.property_website_url && (
              <Button
                variant={activeMediaTab === 'website' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMediaTabChange('website')}
                className="rounded-full"
              >
                <Globe className="w-4 h-4 mr-2" />
                Website
              </Button>
            )}
          </div>

          {/* Price & Address */}
          <div className="mx-auto mt-6">
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h1 className="text-3xl font-bold">{listing.address}</h1>
                <p className="text-lg text-muted-foreground">
                  {listing.city}, {listing.state} {listing.zip_code}
                </p>
              </div>
            </div>
            <div className="text-4xl font-bold text-primary mt-2">
              ${listing.price.toLocaleString()}
              {listing.listing_type === 'for_rent' && (
                <span className="text-xl text-muted-foreground">/month</span>
              )}
            </div>

            {/* Contact Agent Button */}
            {agentProfile && (
              <div className="mt-4">
                <ContactAgentDialog
                  listingId={listing.id}
                  agentId={listing.agent_id}
                  listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
                />
              </div>
            )}

            {/* Key Stats Row */}
            <div className="flex flex-wrap items-center gap-6 py-4 border-y mt-4">
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
            <div className="flex flex-wrap items-center gap-4 text-sm text-foreground font-medium mt-3">
              {listDate && (
                <div>
                  <span className="text-muted-foreground">Listed:</span>{' '}
                  {new Date(listDate).toLocaleDateString()}
                </div>
              )}
              {daysOnMarket && (
                <div>
                  <span className="text-muted-foreground">DOM:</span>{' '}
                  {daysOnMarket}
                </div>
              )}
              {/* Agent-only stats */}
              {isAgentView && (
                <>
                  <div>
                    <span className="text-muted-foreground">Matches:</span> {stats.matches}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>{stats.views}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Two-Column Layout for Details - Max Width 1600px */}
        <div className="mx-auto px-4 py-6" style={{ maxWidth: '1600px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Overview/Description */}
              {listing.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {listing.description}
                    </p>
                    
                    {/* Agent-Only: Broker Remarks */}
                    {isAgentView && listing.broker_comments && (
                      <div className="mt-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                            Broker Remarks
                          </span>
                          <Badge variant="outline" className="text-xs">Agent Only</Badge>
                        </div>
                        <p className="text-sm text-orange-900 dark:text-orange-100 whitespace-pre-wrap">
                          {listing.broker_comments}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* MLS-Style Detail Sections */}
              <ListingDetailSections 
                listing={listing} 
                agent={agentProfile}
                isAgentView={isAgentView}
              />
            </div>

            {/* RIGHT COLUMN - Agent Card, Compensation, Showing, Office Info */}
            <PropertyDetailRightColumn 
              listing={listing} 
              agent={agentProfile}
              isAgentView={isAgentView}
              stats={stats}
            />
          </div>
        </div>
      </main>

      {/* Photo Gallery Dialog */}
      {listing && listing.photos && (
        <PhotoGalleryDialog
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          photos={listing.photos}
          floorPlans={[]}
          initialIndex={currentPhotoIndex}
        />
      )}
    </div>
  );
};

export default PropertyDetail;
