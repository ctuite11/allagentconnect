import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Home,
  FileText,
  ChevronLeft,
  ChevronRight,
  Video,
  Globe,
  Maximize2,
  Expand,
  DollarSign,
  Building2,
  GraduationCap,
  Footprints,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { buildDisplayAddress } from "@/lib/utils";
import { useListingView } from "@/hooks/useListingView";
import { PropertyMetaTags } from "@/components/PropertyMetaTags";
import { ListingDetailSections } from "@/components/ListingDetailSections";
import { BuyerAgentShowcase } from "@/components/BuyerAgentShowcase";
// ContactAgentDialog removed — buyer CTA is in-app messaging only
import { ContactMyAgentDialog } from "@/components/ContactMyAgentDialog";
import PhotoGalleryDialog from "@/components/PhotoGalleryDialog";
import FavoriteButton from "@/components/FavoriteButton";
import ScheduleShowingDialog from "@/components/ScheduleShowingDialog";
// SaveToHotSheetDialog removed — requires search context props not available on single listing view
import PropertyMap from "@/components/PropertyMap";
import AdBanner from "@/components/AdBanner";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";
import { getStatusConfig } from "@/constants/status";
import { syncStickyFromDB } from "@/utils/agentTracking";
import { findOrCreateConversation } from "@/lib/startConversation";

// ATTRIBUTION MASKING (BUYER UI)
// Buyers must NEVER contact listing.agent_id from this page.
// Only the sticky agent is a valid recipient.
type StickyAgentId = string & { __brand: "StickyAgentId" };

function asStickyAgentId(id: string | null | undefined): StickyAgentId | null {
  return id ? (id as StickyAgentId) : null;
}

/* ATTRIBUTION MASKING: Primary contact action is in-app messaging only.
   Do not re-add email form (ContactAgentDialog) as buyer CTA. */

const DEFAULT_BROKERAGE_LOGO_URL = "/placeholder.svg";

interface AgentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  cell_phone: string | null;
  title: string | null;
  headshot_url: string | null;
  logo_url: string | null;
  company: string | null;
  office_name: string | null;
  social_links?: {
    website?: string;
  };
}

const ConsumerPropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [listing, setListing] = useState<any | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'photos' | 'video' | 'tour' | 'website'>('photos');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [stickyAgentId, setStickyAgentId] = useState<string | null>(null);
  const [stickyAgentProfile, setStickyAgentProfile] = useState<AgentProfile | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const handleMessageAgent = async (targetAgentId: string | null | undefined) => {
    try {
      if (!targetAgentId || !listing?.id) return;

      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("auth.getUser error:", error);
        return;
      }

      const userId = data?.user?.id;
      if (!userId) {
        navigate("/login");
        return;
      }

      const conversationId = await findOrCreateConversation(
        userId,
        targetAgentId,
        { listingId: listing.id }
      );

      if (!conversationId) {
        console.error("findOrCreateConversation returned no id");
        return;
      }

      navigate(`/messages/${conversationId}`, {
        state: { from: location.pathname + location.search, fromLabel: "Back to listing" },
      });
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
  };

  // Resolve sticky agent for buyer masking
  useEffect(() => {
    syncStickyFromDB().then(async (agentId) => {
      setStickyAgentId(agentId);
      if (!agentId) {
        setStickyAgentProfile(null);
        return;
      }
      const { data } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email, phone, cell_phone, title, headshot_url, logo_url, company, office_name, social_links")
        .eq("id", agentId)
        .maybeSingle();
      setStickyAgentProfile(data as AgentProfile | null);
    });
  }, []);

  // Track listing view
  useListingView(id);

  useEffect(() => {
    const fetchData = async () => {
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
          });

          // Fetch agent profile
          if (data.agent_id) {
            const { data: profile } = await supabase
              .from("agent_profiles")
              .select("id, first_name, last_name, email, cell_phone, phone, title, company, office_name, headshot_url, logo_url, social_links")
              .eq("id", data.agent_id)
              .maybeSingle();

            if (profile) {
              setAgentProfile(profile as AgentProfile);
            }
          }
        }
      } catch (error: any) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load property details");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id]);

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

  const handleMediaTabChange = (tab: 'photos' | 'video' | 'tour' | 'website') => {
    setActiveMediaTab(tab);
    if (tab === 'photos') setCurrentPhotoIndex(0);
  };

  const handleExpandGallery = () => setGalleryOpen(true);

  const handleCopyLink = async () => {
    const shareUrl = getListingShareUrl(id!);
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
    const { trackShare } = await import("@/lib/trackShare");
    await trackShare(id!, 'copy_link');
  };

  const getStatusColor = (status: string) => {
    const config = getStatusConfig(status, "listing");
    return `${config.bg} ${config.text}`;
  };

  const getCompensationDisplay = () => {
    if (!listing?.commission_rate) return null;
    if (listing.commission_type === 'percentage') return `${listing.commission_rate}%`;
    return `$${listing.commission_rate.toLocaleString()}`;
  };

  if (loading) return <LoadingScreen />;

  if (!listing) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Listing not found</p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => navigate("/browse")}>Back to Search</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getPhotoUrl = (photo: any): string => {
    if (typeof photo === 'string') return photo;
    return photo?.url || '/placeholder.svg';
  };

  const mainPhoto = listing.photos && listing.photos.length > 0
    ? getPhotoUrl(listing.photos[currentPhotoIndex])
    : '/placeholder.svg';

  const listDate = listing.active_date || listing.created_at;
  const daysOnMarket = listDate
    ? Math.ceil((new Date().getTime() - new Date(listDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const compensationDisplay = getCompensationDisplay();
  const agentLogo = agentProfile?.logo_url || DEFAULT_BROKERAGE_LOGO_URL;

  return (
    <div className="min-h-screen bg-background pt-20">
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

      {/* Back Button Row */}
      <div className="mx-auto max-w-6xl px-4 pb-2 flex items-center gap-2">
        <button
          onClick={() => {
            const lastSearch = sessionStorage.getItem("buyer_last_search_url");
            navigate(lastSearch || "/browse");
          }}
          className="p-2 -ml-2 rounded-md hover:bg-muted transition-colors text-neutral-700 hover:text-neutral-900"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate("/client/dashboard")}
          className="p-2 rounded-md hover:bg-muted transition-colors text-neutral-700 hover:text-neutral-900"
          aria-label="Back to dashboard"
        >
          <Home className="h-5 w-5" />
        </button>
      </div>

      <main className="flex-1">
        {/* ========== HERO SECTION: TWO-COLUMN GRID ========== */}
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* LEFT COLUMN - Floating Photo Carousel (~68%) */}
            <div className="lg:w-[68%]">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5 h-[380px] sm:h-[480px] lg:h-[560px]">
                <div className="absolute inset-0 bg-neutral-950">
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
                    <iframe src={listing.video_url} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  )}
                  {activeMediaTab === 'tour' && listing.virtual_tour_url && (
                    <iframe src={listing.virtual_tour_url} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  )}
                  {activeMediaTab === 'website' && listing.property_website_url && (
                    <iframe src={listing.property_website_url} className="w-full h-full" />
                  )}

                  {/* Status Badge & AAC ID - Top Left */}
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

                  {/* Share + Favorite - Top Right */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <FavoriteButton listingId={listing.id} size="icon" variant="secondary" className="rounded-full bg-black/60 hover:bg-black/80 text-white border-0 h-11 w-11" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="bg-black/60 hover:bg-black/80 text-white p-3 rounded-full transition-all backdrop-blur-sm" aria-label="Share property">
                          <Share2 className="w-6 h-6" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">Facebook</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">Twitter</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">LinkedIn</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(listing.address)}%20${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">WhatsApp</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`mailto:?subject=${encodeURIComponent(listing.address)}&body=${encodeURIComponent(getListingShareUrl(id!))}`, "_blank")} className="gap-2 cursor-pointer">Email</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">Copy Link</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Carousel Arrows */}
                  {activeMediaTab === 'photos' && listing.photos && listing.photos.length > 1 && (
                    <>
                      <button onClick={handlePrevPhoto} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm" aria-label="Previous photo">
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button onClick={handleNextPhoto} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm" aria-label="Next photo">
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </>
                  )}

                  {/* Photo Counter */}
                  {activeMediaTab === 'photos' && listing.photos && listing.photos.length > 0 && (
                    <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                      {currentPhotoIndex + 1} / {listing.photos.length}
                    </div>
                  )}

                  {/* Expand Button */}
                  {activeMediaTab === 'photos' && (
                    <button onClick={handleExpandGallery} className="absolute bottom-20 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all backdrop-blur-sm" aria-label="Expand gallery">
                      <Expand className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Media Type Tabs */}
              <div className="flex items-center gap-2 mt-5 flex-wrap">
                <Button variant={activeMediaTab === 'photos' ? 'default' : 'outline'} size="sm" onClick={() => handleMediaTabChange('photos')} className="rounded-full">
                  <Home className="w-4 h-4 mr-2" />Photos
                </Button>
                {listing.video_url && (
                  <Button variant={activeMediaTab === 'video' ? 'default' : 'outline'} size="sm" onClick={() => handleMediaTabChange('video')} className="rounded-full">
                    <Video className="w-4 h-4 mr-2" />Video
                  </Button>
                )}
                {listing.virtual_tour_url && (
                  <Button variant={activeMediaTab === 'tour' ? 'default' : 'outline'} size="sm" onClick={() => handleMediaTabChange('tour')} className="rounded-full">
                    <Maximize2 className="w-4 h-4 mr-2" />3D Tour
                  </Button>
                )}
                {listing.property_website_url && (
                  <Button variant={activeMediaTab === 'website' ? 'default' : 'outline'} size="sm" onClick={() => handleMediaTabChange('website')} className="rounded-full">
                    <Globe className="w-4 h-4 mr-2" />Website
                  </Button>
                )}
              </div>

              {/* Price + Address Header — Compass/Apple hierarchy */}
              <div className="mt-6">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                    ${listing.price.toLocaleString()}
                  </p>
                  {listing.square_feet && (
                    <span className="text-sm text-muted-foreground">
                      ${Math.round(listing.price / listing.square_feet).toLocaleString()}/sq ft
                    </span>
                  )}
                  {listing.listing_type === 'for_rent' && (
                    <span className="text-sm text-muted-foreground">/ month</span>
                  )}
                </div>

                <h1 className="mt-2 text-lg md:text-xl font-medium text-foreground flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1.5" />
                  <span>{buildDisplayAddress(listing)}</span>
                </h1>

                <div className="mt-3 pb-4 border-b border-border/60 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  {listing.bedrooms != null && (
                    <span><span className="font-semibold text-foreground">{listing.bedrooms}</span> Beds</span>
                  )}
                  {listing.bathrooms != null && (
                    <>
                      <span className="text-border">·</span>
                      <span><span className="font-semibold text-foreground">{listing.bathrooms}</span> Baths</span>
                    </>
                  )}
                  {listing.square_feet && (
                    <>
                      <span className="text-border">·</span>
                      <span><span className="font-semibold text-foreground">{listing.square_feet.toLocaleString()}</span> Sq Ft</span>
                    </>
                  )}
                  {daysOnMarket !== null && (
                    <>
                      <span className="text-border">·</span>
                      <span><span className="font-semibold text-foreground">{daysOnMarket}</span> days on market</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - Hero Sidebar (~32%) */}
            <div className="lg:w-[32%] space-y-3 lg:sticky lg:top-24 lg:self-start">

              {/* Your Agent Card (attribution masking) */}
              {stickyAgentProfile ? (
                <Card className="rounded-3xl shadow-md border-2">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <AgentAvatar
                        name={`${stickyAgentProfile.first_name} ${stickyAgentProfile.last_name}`}
                        headshotUrl={stickyAgentProfile.headshot_url ?? null}
                        userId={stickyAgentProfile.id}
                        size="xl"
                        avatarClassName="w-16 h-16 border-2 border-border"
                        fallbackClassName="bg-muted"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Your Agent</p>
                        <p className="font-bold text-lg leading-tight">
                          {stickyAgentProfile.first_name} {stickyAgentProfile.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {stickyAgentProfile.title || 'Realtor'} · {stickyAgentProfile.company || "Brokerage"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      {stickyAgentProfile.cell_phone && (
                        <a href={`tel:${stickyAgentProfile.cell_phone}`} className="flex items-center gap-2.5 hover:text-primary transition">
                          <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{formatPhoneNumber(stickyAgentProfile.cell_phone)}</span>
                          <span className="text-muted-foreground text-xs ml-auto">Mobile</span>
                        </a>
                      )}
                      {stickyAgentProfile.phone && stickyAgentProfile.phone !== stickyAgentProfile.cell_phone && (
                        <a href={`tel:${stickyAgentProfile.phone}`} className="flex items-center gap-2.5 hover:text-primary transition">
                          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{formatPhoneNumber(stickyAgentProfile.phone)}</span>
                          <span className="text-muted-foreground text-xs ml-auto">Office</span>
                        </a>
                      )}
                      {stickyAgentProfile.email && (
                        <a href={`mailto:${stickyAgentProfile.email}`} className="flex items-center gap-2.5 hover:text-primary transition">
                          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{stickyAgentProfile.email}</span>
                        </a>
                      )}
                      {stickyAgentProfile.social_links?.website && (
                        <a href={stickyAgentProfile.social_links.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-primary hover:underline">
                          <Globe className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">Website</span>
                        </a>
                      )}
                    </div>

                    {/* ATTRIBUTION MASKING: Primary contact action is in-app messaging only.
                        Do not re-add email form (ContactAgentDialog) as buyer CTA. */}
                    <div className="grid gap-2">
                      <Button
                        size="lg"
                        className="w-full gap-2"
                        onClick={() => handleMessageAgent(stickyAgentId)}
                      >
                        <MessageSquare className="h-5 w-5" />
                        Message your agent
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => setEmailDialogOpen(true)}
                      >
                        <Mail className="h-4 w-4" />
                        Email your agent
                      </Button>
                      <ContactMyAgentDialog
                        open={emailDialogOpen}
                        onOpenChange={setEmailDialogOpen}
                        agentDisplayName={
                          `${stickyAgentProfile.first_name} ${stickyAgentProfile.last_name}`.trim()
                        }
                        defaultSubject={`Question about ${listing.address}, ${listing.city}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : agentProfile ? (
                <Card className="rounded-3xl shadow-md border-2">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <AgentAvatar
                        name={`${agentProfile.first_name} ${agentProfile.last_name}`}
                        headshotUrl={agentProfile.headshot_url ?? null}
                        userId={agentProfile.id}
                        size="xl"
                        avatarClassName="w-16 h-16 border-2 border-border"
                        fallbackClassName="bg-muted"
                      />
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
                        <a href={`tel:${agentProfile.cell_phone}`} className="flex items-center gap-2.5 hover:text-primary transition">
                          <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.cell_phone)}</span>
                          <span className="text-muted-foreground text-xs ml-auto">Mobile</span>
                        </a>
                      )}
                      {agentProfile.phone && agentProfile.phone !== agentProfile.cell_phone && (
                        <a href={`tel:${agentProfile.phone}`} className="flex items-center gap-2.5 hover:text-primary transition">
                          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.phone)}</span>
                          <span className="text-muted-foreground text-xs ml-auto">Office</span>
                        </a>
                      )}
                      {agentProfile.email && (
                        <a href={`mailto:${agentProfile.email}`} className="flex items-center gap-2.5 hover:text-primary transition">
                          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{agentProfile.email}</span>
                        </a>
                      )}
                      {agentProfile.social_links?.website && (
                        <a href={agentProfile.social_links.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-primary hover:underline">
                          <Globe className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">Website</span>
                        </a>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Button
                        size="lg"
                        className="w-full gap-2"
                        onClick={() => handleMessageAgent(agentProfile.id)}
                      >
                        <MessageSquare className="h-5 w-5" />
                        Message listing agent
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-3xl shadow-md border-2">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <HelpCircle className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Need help?</p>
                        <p className="font-bold text-lg leading-tight">Contact support</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Brokerage Strip */}
              {stickyAgentProfile && (
                <Card className="rounded-2xl shadow-sm border">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        <img
                          src={stickyAgentProfile.logo_url || DEFAULT_BROKERAGE_LOGO_URL}
                          alt={`${stickyAgentProfile.company || 'Brokerage'} logo`}
                          className="h-full w-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_BROKERAGE_LOGO_URL; }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Courtesy of</p>
                        <p className="text-sm font-medium truncate">{stickyAgentProfile.company || "Brokerage"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Buyer Actions */}
              <Card className="rounded-2xl">
                <CardContent className="py-4 px-4 space-y-2">
                  <ScheduleShowingDialog
                    listingId={listing.id}
                    listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
                  />
                  {/* SaveToHotSheet not available on single listing view */}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        {/* END HERO GRID */}


        {/* ========== MAIN CONTENT BELOW ========== */}
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
                    <CardContent className="text-sm leading-relaxed text-foreground space-y-4">
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
                    </CardContent>
                  </Card>
                );
              })()}

              {/* MLS-Style Detail Sections (shared component) */}
              <ListingDetailSections
                listing={listing}
                agent={agentProfile}
                isAgentView={false}
              />

              {/* Listing agent attribution — represented buyers only.
                  Sticky agent is the primary contact; this is muted,
                  no link, no contact details, no hover. */}
              {stickyAgentProfile && agentProfile && agentProfile.id !== stickyAgentProfile.id && (
                <p className="text-xs text-muted-foreground/80 px-1">
                  Listing courtesy of {agentProfile.first_name} {agentProfile.last_name}
                  {agentProfile.company ? ` • ${agentProfile.company}` : ""}
                </p>
              )}

              {/* Map */}
              <Card className="rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PropertyMap
                    address={`${listing.address}, ${listing.city}, ${listing.state} ${listing.zip_code}`}
                    latitude={listing.latitude}
                    longitude={listing.longitude}
                  />
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN - Consumer content */}
            <div className="space-y-6">
              {/* Buyer Agent Compensation */}
              {compensationDisplay && (
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
                            <p>This compensation is <strong className="text-foreground">paid by the seller</strong> and offered to buyer agents who bring qualified buyers.</p>
                            <p><strong className="text-foreground">Is this negotiable?</strong><br />Yes, compensation terms may be negotiable. Discuss with the listing agent for details.</p>
                            <p><strong className="text-foreground">Note:</strong> Actual compensation may vary based on your buyer representation agreement. Ask your agent about their fee structure.</p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Buyer Agent Showcase — only when buyer is unrepresented.
                  Represented buyers already have a sticky agent. */}
              {!stickyAgentProfile && (
                <BuyerAgentShowcase
                  listingZip={listing.zip_code}
                  listingId={listing.id}
                />
              )}

              {/* ATTOM Property Data */}
              {listing.attom_data && Object.keys(listing.attom_data).length > 0 && (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-base">Property Data</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {listing.attom_data.property_type && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Property Type:</span>
                        <span className="font-semibold">{listing.attom_data.property_type}</span>
                      </div>
                    )}
                    {listing.attom_data.stories && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Stories:</span>
                        <span className="font-semibold">{listing.attom_data.stories}</span>
                      </div>
                    )}
                    {listing.attom_data.parking_spaces && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Parking Spaces:</span>
                        <span className="font-semibold">{listing.attom_data.parking_spaces}</span>
                      </div>
                    )}
                    {listing.attom_data.zoning && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Zoning:</span>
                        <span className="font-semibold">{listing.attom_data.zoning}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Schools */}
              {listing.schools_data && listing.schools_data.schools && listing.schools_data.schools.length > 0 && (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GraduationCap className="h-5 w-5" />
                      Nearby Schools
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {listing.schools_data.schools.slice(0, 5).map((school: any, index: number) => (
                      <div key={index} className="pb-3 border-b last:border-0 last:pb-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-semibold text-sm">{school.name}</h4>
                          {school.rating && <Badge variant="secondary">{school.rating}/10</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{school.level} • {school.distance} mi</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Walk Score */}
              {listing.walk_score_data && (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Footprints className="h-5 w-5" />
                      Walk Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {listing.walk_score_data.walkscore && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm">Walk Score</span>
                          <span className="text-2xl font-bold text-primary">{listing.walk_score_data.walkscore}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{listing.walk_score_data.description}</p>
                      </div>
                    )}
                    {listing.walk_score_data.transit && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Transit Score</span>
                          <span className="text-xl font-bold">{listing.walk_score_data.transit.score}</span>
                        </div>
                      </div>
                    )}
                    {listing.walk_score_data.bike && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Bike Score</span>
                          <span className="text-xl font-bold">{listing.walk_score_data.bike.score}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ATTRIBUTION MASKING (BUYER UI):
                 Do not show "Contact listing agent" fallbacks.
                 Buyer may only contact sticky agent or support. */}

              {/* Ad Banner */}
              <AdBanner placementZone="listing_sidebar" className="mt-4" />
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
          floorPlans={listing.floor_plans || []}
          initialIndex={currentPhotoIndex}
        />
      )}
    </div>
  );
};

export default ConsumerPropertyDetail;
