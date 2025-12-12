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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Info,
  Users,
  HelpCircle
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

      {/* Back Button Row - Own row with proper top spacing */}
      <div className="mx-auto max-w-6xl px-4 pt-20 pb-2">
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

      <main className="flex-1">
        {/* Subtle Agent View Indicator */}
        {isAgentView && (
          <div className="mx-auto max-w-6xl px-4 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Info className="w-3 h-3" />
              Internal view – not shown to clients
            </span>
          </div>
        )}

        {/* ========== HERO SECTION: TWO-COLUMN GRID ========== */}
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* LEFT COLUMN - Floating Photo Carousel (~68%) */}
            <div className="lg:w-[68%]">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5 h-[380px] sm:h-[480px] lg:h-[560px]">
                <div className="absolute inset-0 bg-slate-950">
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


                    {/* Expand Button - Top of Bottom Right (above price) */}
                    {activeMediaTab === 'photos' && (
                      <button
                        onClick={handleExpandGallery}
                        className="absolute bottom-20 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all backdrop-blur-sm"
                        aria-label="Expand gallery"
                      >
                        <Expand className="w-5 h-5" />
                      </button>
                    )}
                  </div>
              </div>

              {/* Media Type Tabs - Below Photo with more spacing to clear shadow */}
              <div className="flex items-center justify-between gap-2 mt-6">
                <div className="flex items-center gap-2">
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
                
                {/* Price - Right aligned */}
                <div className="text-primary font-bold text-lg">
                  ${listing.price.toLocaleString()}
                  {listing.square_feet && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      · ${Math.round(listing.price / listing.square_feet).toLocaleString()}/sq ft
                    </span>
                  )}
                </div>
              </div>

              {/* ========== ADDRESS + STATS (INSIDE LEFT COLUMN) - Price is now in photo ========== */}
              <div className="mt-4">
                {/* ROW 1: Address - Title Case, no duplicate city */}
                <h1 className="text-base md:text-lg font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  {buildDisplayAddress(listing)}
                  {listing.listing_type === 'for_rent' && (
                    <span className="text-sm text-muted-foreground font-normal ml-2">(For Rent)</span>
                  )}
                </h1>

                {/* ROW 2: Stats - directly under, no gap */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 pb-2 border-b">
                  {listing.bedrooms && (
                    <div className="flex items-center gap-1">
                      <Bed className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">{listing.bedrooms}</span>
                      <span className="text-xs text-muted-foreground">Beds</span>
                    </div>
                  )}
                  {listing.bathrooms && (
                    <div className="flex items-center gap-1">
                      <Bath className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">{listing.bathrooms}</span>
                      <span className="text-xs text-muted-foreground">Baths</span>
                    </div>
                  )}
                  {listing.square_feet && (
                    <div className="flex items-center gap-1">
                      <Square className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">{listing.square_feet.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">Sq Ft</span>
                    </div>
                  )}
                  {daysOnMarket !== null && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">{daysOnMarket}</span>
                      <span className="text-xs text-muted-foreground">DOM</span>
                    </div>
                  )}
                </div>
              </div>

            </div>


            {/* RIGHT COLUMN - Hero Sidebar (~32%) - Clean, no internal scrolling */}
            <div className="lg:w-[32%] space-y-3 lg:sticky lg:top-24 lg:self-start">
              
              {/* Listing Agent Card - PRIMARY (top) */}
              {agentProfile && (
                <Card className="rounded-3xl shadow-md border-2">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16 border-2 border-primary/20">
                        {agentProfile.headshot_url ? (
                          <AvatarImage src={agentProfile.headshot_url} />
                        ) : (
                          <AvatarFallback className="text-lg font-semibold bg-primary/10">
                            {agentProfile.first_name[0]}{agentProfile.last_name[0]}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Listing Agent</p>
                        <p className="font-bold text-lg leading-tight">
                          {agentProfile.first_name} {agentProfile.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {agentProfile.title || 'Realtor'} · {agentProfile.company || "Brokerage"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      {agentProfile.cell_phone && (
                        <a
                          href={`tel:${agentProfile.cell_phone}`}
                          className="flex items-center gap-2.5 hover:text-primary transition"
                        >
                          <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.cell_phone)}</span>
                          <span className="text-muted-foreground text-xs ml-auto">Mobile</span>
                        </a>
                      )}
                      {agentProfile.phone && agentProfile.phone !== agentProfile.cell_phone && (
                        <a
                          href={`tel:${agentProfile.phone}`}
                          className="flex items-center gap-2.5 hover:text-primary transition"
                        >
                          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.phone)}</span>
                          <span className="text-muted-foreground text-xs ml-auto">Office</span>
                        </a>
                      )}
                      {agentProfile.email && (
                        <a
                          href={`mailto:${agentProfile.email}`}
                          className="flex items-center gap-2.5 hover:text-primary transition"
                        >
                          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{agentProfile.email}</span>
                        </a>
                      )}
                      {agentProfile.social_links?.website && (
                        <a
                          href={agentProfile.social_links.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 text-primary hover:underline"
                        >
                          <Globe className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">Website</span>
                        </a>
                      )}
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
              <Card className="rounded-2xl shadow-sm border">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Listing courtesy of</p>
                      <p className="text-sm font-medium truncate">
                        {agentProfile?.company || "Brokerage"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ========== AGENT QUICK ACTIONS (stays in sidebar) ========== */}
              {isAgentView && (
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
                      onClick={() => {
                        const el = document.getElementById('agent-tools-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full justify-start gap-2"
                    >
                      <Activity className="w-4 h-4" />
                      View Agent Tools
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
        {/* END HERO GRID */}


        {/* ========== MAIN CONTENT BELOW (MINIMAL GAP) ========== */}
        <div className="mx-auto max-w-6xl px-4 pt-2 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT COLUMN - Main Content */}
            <div className="lg:col-span-2 space-y-4">
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
              {/* Buyer Agent Compensation - Client View Only (single line with info popup) */}
              {!isAgentView && compensationDisplay && (
                <Card className="rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <DollarSign className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        Buyer Agent Compensation: {compensationDisplay} (paid by seller)
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="text-emerald-600 hover:text-emerald-800 ml-auto">
                            <HelpCircle className="w-4 h-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-emerald-600" />
                              Buyer Agent Compensation
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 py-4 text-sm text-muted-foreground">
                            <p>
                              This compensation is <strong className="text-foreground">paid by the seller</strong> and 
                              offered to buyer agents who bring qualified buyers.
                            </p>
                            <p>
                              <strong className="text-foreground">Is this negotiable?</strong><br />
                              Yes, compensation terms may be negotiable. Discuss with the listing agent for details.
                            </p>
                            <p>
                              <strong className="text-foreground">Note:</strong> Actual compensation may vary based on 
                              your buyer representation agreement. Ask your agent about their fee structure.
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
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

        {/* ========== AGENT TOOLS SECTION (Agent-Only, NOT sticky) - 50/50 layout ========== */}
        {isAgentView && (
          <div id="agent-tools-section" className="mx-auto max-w-6xl px-4 pb-8">
            <div className="border-t pt-6 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-muted-foreground" />
                  Agent Tools
                  <Badge variant="outline" className="ml-2 text-xs">Internal Only</Badge>
                </h2>
                {/* Views & Matches grouped with Broadcast */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4 text-primary" />
                      <strong>{stats.views}</strong> Views
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-primary" />
                      <strong>{stats.matches}</strong> Matches
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/communication-center?listing=${listing.id}`)}
                    className="px-4"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Message All Matches
                  </Button>
                </div>
              </div>
              
              {/* 50/50 Two-Column Layout - Equal Height Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT COLUMN (Blue): Showing Instructions */}
                <Card className="rounded-2xl border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 h-full">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
                      <KeyRound className="w-4 h-4" />
                      Showing Instructions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="space-y-2 text-sm">
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
                          <span className="font-mono font-medium">{listing.lockbox_code}</span>
                        </div>
                      )}
                      {listing.showing_contact_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Contact</span>
                          <span className="font-medium">{listing.showing_contact_name}</span>
                        </div>
                      )}
                      {listing.showing_contact_phone && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="font-medium">{formatPhoneNumber(listing.showing_contact_phone)}</span>
                        </div>
                      )}
                    </div>
                    {listing.showing_instructions && (
                      <div className="pt-3 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Instructions:</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{listing.showing_instructions}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* RIGHT COLUMN (Yellow): Disclosures, Exclusions, Listing Agreement, Firm Remarks */}
                <Card className="rounded-2xl border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 h-full">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
                      <FileText className="w-4 h-4" />
                      Disclosures, Exclusions & Listing Agreement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3 text-sm">
                    {listing.disclosures && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Disclosures:</p>
                        <p>
                          {typeof listing.disclosures === 'string' 
                            ? listing.disclosures 
                            : formatArray(listing.disclosures) || 'None specified'}
                        </p>
                      </div>
                    )}
                    {listing.listing_exclusions && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Exclusions:</p>
                        <p>{listing.listing_exclusions}</p>
                      </div>
                    )}
                    {listing.listing_agreement_types && formatArray(listing.listing_agreement_types) && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Listing Agreement:</p>
                        <p className="font-medium">{formatArray(listing.listing_agreement_types)}</p>
                      </div>
                    )}
                    {listing.documents && Array.isArray(listing.documents) && listing.documents.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Documents:</p>
                        <p className="text-primary">{listing.documents.length} document(s) available</p>
                      </div>
                    )}
                    {/* Firm Remarks inside yellow card */}
                    {listing.broker_comments && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                          Firm Remarks
                          <Badge variant="outline" className="text-[10px] ml-1">Agent Only</Badge>
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">{listing.broker_comments}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Buyer Agent Compensation - Green Box */}
              {compensationDisplay && (
                <Card className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <DollarSign className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        Buyer Agent Compensation: {compensationDisplay} (paid by seller)
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="text-emerald-600 hover:text-emerald-800 ml-auto">
                            <HelpCircle className="w-4 h-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-emerald-600" />
                              Buyer Agent Compensation
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 py-4 text-sm text-muted-foreground">
                            <p>
                              This compensation is <strong className="text-foreground">paid by the seller</strong> and 
                              offered to buyer agents who bring qualified buyers.
                            </p>
                            <p>
                              <strong className="text-foreground">Is this negotiable?</strong><br />
                              Yes, compensation terms may be negotiable. Discuss with the listing agent for details.
                            </p>
                            {listing.commission_notes && (
                              <p className="bg-muted p-2 rounded text-foreground/80">
                                <strong>Notes:</strong> {listing.commission_notes}
                              </p>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
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
