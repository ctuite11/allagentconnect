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
import { PropertyHeader } from "@/components/property/PropertyHeader";
import { PropertyFactsRow } from "@/components/property/PropertyFactsRow";
import { BrokerageStrip } from "@/components/property/BrokerageStrip";
import { MediaTabBar, type MediaTab } from "@/components/property/MediaTabBar";
import { SectionWrapper } from "@/components/property/SectionWrapper";
import {
  propertyPageContainer,
  propertyHeroGap,
  propertyMediaCol,
  propertyRailCol,
  propertyRailSticky,
  propertyRailStack,
  propertyHeroMedia,
} from "@/components/property/propertyTokens";
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
      <div className="min-h-screen bg-background">
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
  const neighborhoodLabel =
    typeof listing.neighborhood === "string" && listing.neighborhood.trim()
      ? listing.neighborhood.trim()
      : null;

  const buyerCompensationCard =
    compensationDisplay && (
      <Card className="rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="py-2.5 px-3.5">
          <div className="flex items-start gap-2">
            <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-emerald-800 dark:text-emerald-200">
              Buyer Agent Compensation: {compensationDisplay} (paid by seller)
            </span>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 text-emerald-600 hover:text-emerald-800"
                >
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
                    This compensation is{" "}
                    <strong className="text-foreground">paid by the seller</strong> and offered
                    to buyer agents who bring qualified buyers.
                  </p>
                  <p>
                    <strong className="text-foreground">Is this negotiable?</strong>
                    <br />
                    Yes, compensation terms may be negotiable. Discuss with the listing agent for
                    details.
                  </p>
                  <p>
                    <strong className="text-foreground">Note:</strong> Actual compensation may
                    vary based on your buyer representation agreement. Ask your agent about their
                    fee structure.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );

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

      {/* Back Button Row */}
      <div className="mx-auto max-w-6xl px-4 pt-5 pb-3">
        <button
          onClick={() => {
            const from = (location.state as { from?: string } | null)?.from;
            if (from) {
              navigate(from);
              return;
            }
            const lastSearch = sessionStorage.getItem("buyer_last_search_url");
            navigate(lastSearch || "/browse");
          }}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1">
        {/* ========== LISTING HEADER — shared primitive ========== */}
        <PropertyHeader
          address={buildDisplayAddress(listing as any)}
          price={listing?.price ?? null}
          priceSuffix={listing.listing_type === 'for_rent' ? '/ mo' : undefined}
        />

        {/* ========== HERO SECTION: TWO-COLUMN GRID ========== */}
        <div className={propertyPageContainer}>
          <div className={`flex flex-col lg:flex-row ${propertyHeroGap}`}>

            {/* LEFT COLUMN - Floating Photo Carousel (~68%) */}
            <div className={propertyMediaCol}>
              <div className={propertyHeroMedia}>
                <div className="absolute inset-0 bg-neutral-950">
                  {/* Media Content */}
                  {activeMediaTab === "photos" && (
                    <img
                      src={mainPhoto}
                      alt={listing.address}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={handleExpandGallery}
                    />
                  )}
                  {activeMediaTab === "video" && listing.video_url && (
                    <iframe
                      src={listing.video_url}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                  {activeMediaTab === "tour" && listing.virtual_tour_url && (
                    <iframe
                      src={listing.virtual_tour_url}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                  {activeMediaTab === "website" && listing.property_website_url && (
                    <iframe src={listing.property_website_url} className="w-full h-full" />
                  )}

                  {/* Status Badge - Top Left (NO AAC# for consumer view) */}
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <Badge className={`${getStatusColor(listing.status)} bg-white/90 backdrop-blur-sm`}>
                      {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                    </Badge>
                  </div>

                  {/* Favorite - Top Right */}
                  <div
                    className="absolute top-3 right-3 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FavoriteButton listingId={listing.id} size="icon" photoIcon />
                  </div>

                  {/* Carousel Arrows */}
                  {activeMediaTab === "photos" && listing.photos && listing.photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevPhoto}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextPhoto}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </>
                  )}

                  {/* Neighborhood + photo counter — bottom left */}
                  {activeMediaTab === "photos" && (
                    <div className="absolute bottom-4 left-4 z-10 flex max-w-[min(100%,18rem)] flex-col items-start gap-2">
                      {neighborhoodLabel && (
                        <span className="inline-flex max-w-full rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white/95 shadow-sm backdrop-blur-sm">
                          <span className="text-white/70">Neighborhood</span>
                          <span className="mx-1.5 text-white/40">·</span>
                          <span className="min-w-0 truncate">{neighborhoodLabel}</span>
                        </span>
                      )}
                      {listing.photos && listing.photos.length > 0 && (
                        <div className="shrink-0 bg-black/70 px-3 py-1 text-sm text-white rounded-full backdrop-blur-sm">
                          {currentPhotoIndex + 1} / {listing.photos.length}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expand Button */}
                  {activeMediaTab === "photos" && (
                    <button
                      type="button"
                      onClick={handleExpandGallery}
                      className="absolute bottom-4 right-4 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all backdrop-blur-sm"
                      aria-label="Expand gallery"
                    >
                      <Expand className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              <MediaTabBar
                active={activeMediaTab as MediaTab}
                onChange={(tab) => handleMediaTabChange(tab)}
                hasVideo={!!listing.video_url}
                hasTour={!!listing.virtual_tour_url}
                hasWebsite={!!listing.property_website_url}
                trailing={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-full" aria-label="Share property">
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getListingShareUrl(id!))}`,
                            "_blank"
                          )
                        }
                        className="gap-2 cursor-pointer"
                      >
                        Facebook
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            `https://twitter.com/intent/tweet?url=${encodeURIComponent(getListingShareUrl(id!))}`,
                            "_blank"
                          )
                        }
                        className="gap-2 cursor-pointer"
                      >
                        Twitter
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getListingShareUrl(id!))}`,
                            "_blank"
                          )
                        }
                        className="gap-2 cursor-pointer"
                      >
                        LinkedIn
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            `https://wa.me/?text=${encodeURIComponent(listing.address)}%20${encodeURIComponent(getListingShareUrl(id!))}`,
                            "_blank"
                          )
                        }
                        className="gap-2 cursor-pointer"
                      >
                        WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            `mailto:?subject=${encodeURIComponent(listing.address)}&body=${encodeURIComponent(getListingShareUrl(id!))}`,
                            "_blank"
                          )
                        }
                        className="gap-2 cursor-pointer"
                      >
                        Email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
                        Copy Link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />

              <PropertyFactsRow
                bedrooms={listing.bedrooms}
                bathrooms={listing.bathrooms}
                squareFeet={listing.square_feet}
                price={listing.price}
                daysOnMarket={daysOnMarket}
                containerClassName="!mt-9"
                className="!mt-0 border-b-0 pb-0"
              />
            </div>

            {/* RIGHT COLUMN - Hero Sidebar (~32%) */}
            <div className={`${propertyRailCol} ${propertyRailStack} ${propertyRailSticky}`}>

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

              {/* Brokerage Strip — shared primitive */}
              {(() => {
                const displayAgent = stickyAgentProfile || agentProfile;
                if (!displayAgent) return null;
                return (
                  <BrokerageStrip
                    label={stickyAgentProfile ? 'Represented by' : 'Listing courtesy of'}
                    brokerageName={displayAgent.company || displayAgent.office_name}
                    logoUrl={displayAgent.logo_url}
                  />
                );
              })()}

              <ScheduleShowingDialog
                listingId={listing.id}
                listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
              />

              {buyerCompensationCard}
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
                  <SectionWrapper
                    title="Overview"
                    icon={<FileText className="w-5 h-5" />}
                    contentClassName="space-y-4"
                  >
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
                  </SectionWrapper>
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
              <SectionWrapper
                title="Location"
                icon={<MapPin className="h-5 w-5" />}
              >
                <PropertyMap
                  address={`${listing.address}, ${listing.city}, ${listing.state} ${listing.zip_code}`}
                  latitude={listing.latitude}
                  longitude={listing.longitude}
                />
              </SectionWrapper>
            </div>

            {/* RIGHT COLUMN - Consumer content */}
            <div className="space-y-6">
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
                <SectionWrapper title="Property Data" contentClassName="space-y-2">
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
                </SectionWrapper>
              )}

              {/* Schools */}
              {listing.schools_data && listing.schools_data.schools && listing.schools_data.schools.length > 0 && (
                <SectionWrapper
                  title="Nearby Schools"
                  icon={<GraduationCap className="h-5 w-5" />}
                  contentClassName="space-y-3"
                >
                  {listing.schools_data.schools.slice(0, 5).map((school: any, index: number) => (
                    <div key={index} className="pb-3 border-b last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-sm">{school.name}</h4>
                        {school.rating && <Badge variant="secondary">{school.rating}/10</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{school.level} • {school.distance} mi</p>
                    </div>
                  ))}
                </SectionWrapper>
              )}

              {/* Walk Score */}
              {listing.walk_score_data && (
                <SectionWrapper
                  title="Walk Score"
                  icon={<Footprints className="h-5 w-5" />}
                  contentClassName="space-y-3"
                >
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
                </SectionWrapper>
              )}

              {/* ATTRIBUTION MASKING (BUYER UI):
                 Do not show "Contact listing agent" fallbacks.
                 Buyer may only contact sticky agent or support. */}

              {/* Ad Banner */}
              <AdBanner placementZone="listing_sidebar" className="mt-4" />
            </div>
          </div>
        </div>
      </div>

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
