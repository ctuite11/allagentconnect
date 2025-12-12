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
  Send,
  DollarSign,
  KeyRound,
  ClipboardList,
  Activity,
  Copy,
  Building2,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { buildDisplayAddress } from "@/lib/utils";
import { useListingView } from "@/hooks/useListingView";
import { useAuthRole } from "@/hooks/useAuthRole";
import { PropertyMetaTags } from "@/components/PropertyMetaTags";
import { ListingDetailSections } from "@/components/ListingDetailSections";
import { BuyerAgentShowcase } from "@/components/BuyerAgentShowcase";
import { BuyerCompensationInfoModal } from "@/components/BuyerCompensationInfoModal";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import PhotoGalleryDialog from "@/components/PhotoGalleryDialog";
import SocialShareMenu from "@/components/SocialShareMenu";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DEFAULT_BROKERAGE_LOGO_URL = "/placeholder.svg";

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
  appointment_required?: boolean;
  entry_only?: boolean;
  lockbox_code?: string | null;
  showing_contact_name?: string | null;
  showing_contact_phone?: string | null;
  showing_instructions?: string | null;
  disclosures?: any;
  listing_exclusions?: string | null;
  documents?: any[] | null;
  listing_agreement_types?: any;
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
  social_links?: {
    website?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  
  // Role detection + URL-based client mode
  const { user, role, loading: roleLoading } = useAuthRole();
  const isAgent = role === "agent";
  
  // Check for client mode via URL query param or path suffix
  const searchParams = new URLSearchParams(location.search);
  const isClientMode = searchParams.get('view') === 'client' || location.pathname.endsWith('/client');
  const isAgentView = isAgent && !isClientMode;

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
              .select("id, first_name, last_name, email, cell_phone, phone, title, company, headshot_url, logo_url, social_links")
              .eq("id", data.agent_id)
              .maybeSingle();

            if (profile) {
              setAgentProfile(profile as AgentProfile);
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

  const handleCopyClientLink = () => {
    const url = `${window.location.origin}/property/${listing?.id}?view=client`;
    navigator.clipboard.writeText(url);
    toast.success("Client link copied to clipboard");
  };

  const handlePreviewClientView = () => {
    window.open(`${window.location.origin}/property/${listing?.id}?view=client`, '_blank');
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

  const formatArray = (arr: any[] | null | undefined) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    return arr.map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.name || item.label || item.value || JSON.stringify(item);
      }
      return String(item);
    }).join(', ');
  };

  const getCompensationDisplay = () => {
    if (!listing?.commission_rate) return null;
    if (listing.commission_type === 'percentage') {
      return `${listing.commission_rate}%`;
    }
    return `$${listing.commission_rate.toLocaleString()}`;
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

  const compensationDisplay = getCompensationDisplay();
  const agentLogo = agentProfile?.logo_url || DEFAULT_BROKERAGE_LOGO_URL;

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

      {/* Compact Header Bar - No border */}
      <div className="bg-card sticky top-16 z-10 mt-2">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-12">
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
          </div>
        </div>
      </div>

      <main className="flex-1 pt-2">
        {/* Subtle Agent View Indicator - replaces banners */}
        {isAgentView && (
          <div className="mx-auto max-w-6xl px-4 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Info className="w-3 h-3" />
              Internal view – not shown to clients
            </span>
          </div>
        )}

        {/* ========== NEW FLOATING HERO LAYOUT ========== */}
        <div className="mx-auto max-w-6xl px-4 pt-2 lg:pt-4">
          <div className="flex flex-col lg:flex-row gap-10">
            
            {/* LEFT COLUMN - Floating Photo Carousel (~70%) */}
            <div className="lg:w-[70%]">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5 h-[320px] sm:h-[400px] lg:h-[540px]">
                <div className="absolute inset-0 bg-slate-950">
                  {/* Days on Market Badge - Bottom Right */}
                  {daysOnMarket !== null && (
                    <div className="absolute bottom-4 right-4 z-20 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">{daysOnMarket} Days</span>
                    </div>
                  )}
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
                    <div className="absolute top-4 right-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="bg-black/60 hover:bg-black/80 text-white p-3 rounded-full transition-all backdrop-blur-sm"
                            aria-label="Share property"
                          >
                            <Share2 className="w-6 h-6" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">
                            Facebook
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">
                            Twitter
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">
                            LinkedIn
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(listing.address)}%20${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">
                            WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`mailto:?subject=${encodeURIComponent(listing.address)}&body=${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">
                            Email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
                            Copy Link
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
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

                    {/* Expand Button - Bottom Right */}
                    {activeMediaTab === 'photos' && (
                      <button
                        onClick={handleExpandGallery}
                        className="absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all backdrop-blur-sm"
                        aria-label="Expand gallery"
                      >
                        <Expand className="w-5 h-5" />
                      </button>
                    )}
                  </div>
              </div>

              {/* Media Type Tabs - Below Photo */}
              <div className="flex items-center gap-2 mt-4">
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

              {/* ========== TITLE, PRICE & BASICS - DIRECTLY BELOW PHOTO ========== */}
              <div className="mt-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-5 h-5 mt-1 text-muted-foreground flex-shrink-0" />
                      <h1 className="text-2xl md:text-3xl font-semibold">
                        {buildDisplayAddress(listing)}
                      </h1>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-primary">
                      ${listing.price.toLocaleString()}
                      {listing.listing_type === 'for_rent' && (
                        <span className="text-xl text-muted-foreground">/month</span>
                      )}
                    </div>
                    {listing.square_feet && (
                      <p className="text-sm text-muted-foreground mt-1">
                        ${Math.round(listing.price / listing.square_feet).toLocaleString()} / sq ft
                      </p>
                    )}
                  </div>
                </div>

                {/* Key Stats Row */}
                <div className="flex flex-wrap items-center gap-5 text-sm md:text-base py-4 border-y mt-4">
                  {listing.bedrooms && (
                    <div className="flex items-center gap-2">
                      <Bed className="h-5 w-5 md:h-6 md:w-6 text-slate-600" strokeWidth={2} />
                      <span className="font-bold text-foreground">{listing.bedrooms}</span>
                      <span className="text-slate-500">Beds</span>
                    </div>
                  )}
                  {listing.bathrooms && (
                    <div className="flex items-center gap-2">
                      <Bath className="h-5 w-5 md:h-6 md:w-6 text-slate-600" strokeWidth={2} />
                      <span className="font-bold text-foreground">{listing.bathrooms}</span>
                      <span className="text-slate-500">Baths</span>
                    </div>
                  )}
                  {listing.square_feet && (
                    <div className="flex items-center gap-2">
                      <Square className="h-5 w-5 md:h-6 md:w-6 text-slate-600" strokeWidth={2} />
                      <span className="font-bold text-foreground">{listing.square_feet.toLocaleString()}</span>
                      <span className="text-slate-500">Sq Ft</span>
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* RIGHT COLUMN - Hero Sidebar (~30%) */}
            <div className="lg:w-[30%] space-y-4 lg:sticky lg:top-24 lg:self-start">
              
              {/* Listing Agent Card - PRIMARY (top) */}
              {agentProfile && (
                <Card className="rounded-3xl shadow-md">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-14 h-14">
                        {agentProfile.headshot_url ? (
                          <AvatarImage src={agentProfile.headshot_url} />
                        ) : (
                          <AvatarFallback className="text-base">
                            {agentProfile.first_name[0]}{agentProfile.last_name[0]}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Listing Agent</p>
                        <p className="font-semibold">
                          {agentProfile.first_name} {agentProfile.last_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {agentProfile.title || 'Realtor'} · {agentProfile.company || "Brokerage"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      {agentProfile.cell_phone && (
                        <a
                          href={`tel:${agentProfile.cell_phone}`}
                          className="flex items-center gap-2 hover:text-primary transition"
                        >
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.cell_phone)}</span>
                          <span className="text-slate-500 text-xs">Mobile</span>
                        </a>
                      )}
                      {agentProfile.phone && agentProfile.phone !== agentProfile.cell_phone && (
                        <a
                          href={`tel:${agentProfile.phone}`}
                          className="flex items-center gap-2 hover:text-primary transition"
                        >
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.phone)}</span>
                          <span className="text-slate-500 text-xs">Office</span>
                        </a>
                      )}
                      {agentProfile.email && (
                        <a
                          href={`mailto:${agentProfile.email}`}
                          className="flex items-center gap-2 hover:text-primary transition"
                        >
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium truncate">{agentProfile.email}</span>
                        </a>
                      )}
                      <div className="flex items-center gap-3">
                        {agentProfile.social_links?.website && (
                          <a
                            href={agentProfile.social_links.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline"
                          >
                            <Globe className="w-4 h-4" />
                            <span className="font-medium">Website</span>
                          </a>
                        )}
                        <SocialShareMenu
                          url={getListingShareUrl(id!)}
                          title={`${listing.address}, ${listing.city}, ${listing.state}`}
                          description={listing.description || ''}
                          listingId={id!}
                        />
                      </div>
                    </div>

                    <ContactAgentDialog
                      listingId={listing.id}
                      agentId={listing.agent_id}
                      listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
                    />
                  </CardContent>
                </Card>
              )}
              
              {/* Brokerage Strip - SECONDARY (below agent) */}
              <Card className="rounded-2xl shadow-sm border border-slate-100">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img
                        src={agentLogo}
                        alt={`${agentProfile?.company || 'Brokerage'} logo`}
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_BROKERAGE_LOGO_URL;
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Listing Brokerage</p>
                      <p className="text-sm font-medium truncate">
                        {agentProfile?.company || "Brokerage"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ========== AGENT-ONLY CARDS ========== */}
              {isAgentView && (
                <>
                  {/* Agent Actions Card */}
                  <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardContent className="py-4 px-4 space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/agent/listings/edit/${id}`)}
                        className="w-full justify-start gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Listing
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviewClientView}
                        className="w-full justify-start gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Preview Client View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/communication-center?listing=${listing.id}`)}
                        className="w-full justify-start gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Send to Matching Agents
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Buyer Agent Compensation */}
                  {compensationDisplay && (
                    <Card className="rounded-2xl border-green-200 bg-green-50/50 dark:bg-green-950/20">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="flex items-center gap-2 text-sm text-green-900 dark:text-green-100">
                          <DollarSign className="w-4 h-4" />
                          Buyer Agent Compensation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <p className="text-xl font-bold text-green-700 dark:text-green-300">
                          {compensationDisplay}
                        </p>
                        {listing.commission_notes && (
                          <p className="text-xs text-foreground/80 mt-2 border-t pt-2">
                            {listing.commission_notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Showing Instructions */}
                  <Card className="rounded-2xl border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
                        <KeyRound className="w-4 h-4" />
                        Showing Instructions
                        <Badge variant="outline" className="ml-auto text-xs">Agent Only</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Appointment Required</span>
                          <span className="font-medium">{listing.appointment_required ? 'Yes' : 'No'}</span>
                        </div>
                        {listing.entry_only !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Entry Only</span>
                            <span className="font-medium">{listing.entry_only ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                        {listing.lockbox_code && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Lockbox Code</span>
                            <span className="font-medium">{listing.lockbox_code}</span>
                          </div>
                        )}
                        {listing.showing_contact_name && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Showing Contact</span>
                            <span className="font-medium">{listing.showing_contact_name}</span>
                          </div>
                        )}
                        {listing.showing_contact_phone && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Showing Phone</span>
                            <span className="font-medium">{formatPhoneNumber(listing.showing_contact_phone)}</span>
                          </div>
                        )}
                      </div>
                      {listing.showing_instructions && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Instructions:</p>
                          <p className="text-sm whitespace-pre-wrap">{listing.showing_instructions}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Disclosures & Exclusions */}
                  {(listing.disclosures || listing.listing_exclusions) && (
                    <Card className="rounded-2xl border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
                          <FileText className="w-4 h-4" />
                          Disclosures & Exclusions
                          <Badge variant="outline" className="ml-auto text-xs">Agent Only</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2">
                        {listing.disclosures && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Disclosures:</p>
                            <p className="text-sm">
                              {typeof listing.disclosures === 'string' 
                                ? listing.disclosures 
                                : formatArray(listing.disclosures) || 'None specified'}
                            </p>
                          </div>
                        )}
                        {listing.listing_exclusions && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Exclusions:</p>
                            <p className="text-sm">{listing.listing_exclusions}</p>
                          </div>
                        )}
                        {listing.documents && Array.isArray(listing.documents) && listing.documents.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Documents Available:</p>
                            <p className="text-sm text-primary">{listing.documents.length} document(s)</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Listing Agreement Type */}
                  {listing.listing_agreement_types && formatArray(listing.listing_agreement_types) && (
                    <Card className="rounded-2xl border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="flex items-center gap-2 text-sm text-purple-900 dark:text-purple-100">
                          <ClipboardList className="w-4 h-4" />
                          Listing Agreement
                          <Badge variant="outline" className="ml-auto text-xs">Agent Only</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <p className="text-sm font-medium">{formatArray(listing.listing_agreement_types)}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Activity Stats */}
                  <Card className="rounded-2xl border-teal-200 bg-teal-50/50 dark:bg-teal-950/20">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="flex items-center gap-2 text-sm text-teal-900 dark:text-teal-100">
                        <Activity className="w-4 h-4" />
                        Activity & Stats
                        <Badge variant="outline" className="ml-auto text-xs">Agent Only</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5 border">
                          <div className="text-lg font-bold text-teal-700 dark:text-teal-300">
                            {stats.matches}
                          </div>
                          <div className="text-xs text-muted-foreground">Matches</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5 border">
                          <div className="text-lg font-bold text-teal-700 dark:text-teal-300">
                            {stats.views}
                          </div>
                          <div className="text-xs text-muted-foreground">Views</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>

        </div>


        {/* ========== MAIN CONTENT BELOW HERO ========== */}
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Overview/Description with Read More */}
              {listing.description && (() => {
                const MAX_CHARS = 650;
                const full = listing.description || '';
                const isLong = full.length > MAX_CHARS;
                const visibleText = !isLong || descriptionExpanded ? full : `${full.slice(0, MAX_CHARS)}…`;
                
                return (
                  <Card className="rounded-3xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5" />
                        Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 space-y-4">
                      <p className="whitespace-pre-wrap">{visibleText}</p>
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => setDescriptionExpanded(v => !v)}
                          className="text-primary font-medium text-sm"
                        >
                          {descriptionExpanded ? 'Read less' : 'Read more'}
                        </button>
                      )}
                      
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
                );
              })()}

              {/* MLS-Style Detail Sections */}
              <ListingDetailSections 
                listing={listing} 
                agent={agentProfile}
                isAgentView={isAgentView}
              />
            </div>

            {/* RIGHT COLUMN - Consumer-facing content (not in hero sidebar) */}
            <div className="space-y-6">
              {/* Buyer Agent Fee - Public Version (Client View Only) */}
              {!isAgentView && compensationDisplay && (
                <Card className="rounded-3xl border border-emerald-100 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-emerald-700" />
                          <CardTitle className="text-base">Buyer Agent Fee</CardTitle>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Compensation paid by the seller of this home.
                        </p>
                      </div>
                      <BuyerCompensationInfoModal compensationDisplay={compensationDisplay} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
                      {compensationDisplay}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Offered by the listing brokerage to a buyer's agent at closing.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Buyer Agent Showcase - Client View Only */}
              {!isAgentView && (
                <BuyerAgentShowcase 
                  listingZip={listing.zip_code} 
                  listingId={listing.id} 
                />
              )}

              {/* Fallback if no agent */}
              {!agentProfile && !isAgentView && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Interested in this property?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Contact the listing agent for more information or to schedule a showing.
                    </p>
                    <Button className="w-full">Contact Agent</Button>
                  </CardContent>
                </Card>
              )}
            </div>
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
