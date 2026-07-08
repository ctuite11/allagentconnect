import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/LoadingScreen";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import {
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
  Expand,
  Building2,
  GraduationCap,
  Footprints,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { formatConsumerPropertyTypeLabel } from "@/lib/format";
import { formatListingEmailSubjectLocation } from "@/lib/listingEmailSubject";
import { buildDisplayAddress } from "@/lib/utils";
import { useListingView } from "@/hooks/useListingView";
import { PropertyMetaTags } from "@/components/PropertyMetaTags";
import { ListingDetailSections } from "@/components/ListingDetailSections";
import { PropertyHeader } from "@/components/property/PropertyHeader";
import { BuyerAgentFeeDetail, formatBuyerAgentFeeDisplay } from "@/components/property/BuyerAgentFeeDetail";
import { PropertyFactsRow, propertyPhotoContentInset } from "@/components/property/PropertyFactsRow";
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
  propertyDetailRailActionGroup,
  propertyDetailAgentCardContent,
  propertyDetailAgentEyebrow,
  propertyDetailAgentTitleBlock,
  propertyDetailAgentContactRows,
  propertyDetailMessageCtaBase,
  propertyDetailMessageCta,
  propertyDetailScheduleCtaBase,
  propertyDetailScheduleCta,
  propertyDetailAgentAvatar,
} from "@/components/property/propertyTokens";
import { cn } from "@/lib/utils";
import { BuyerAgentShowcase } from "@/components/BuyerAgentShowcase";
// ContactAgentDialog removed — buyer CTA is in-app messaging only
import PhotoGalleryDialog from "@/components/PhotoGalleryDialog";
import FavoriteButton from "@/components/FavoriteButton";
import ScheduleShowingDialog from "@/components/ScheduleShowingDialog";
// SaveToHotSheetDialog removed — requires search context props not available on single listing view
import PropertyMap from "@/components/PropertyMap";
import AdBanner from "@/components/AdBanner";
import SocialShareMenu from "@/components/SocialShareMenu";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";
import { formatListingPriceDisplay } from "@/lib/formatListingPriceDisplay";
import { getStatusConfig } from "@/constants/status";
import { syncStickyFromDB } from "@/utils/agentTracking";
import { buildMessageReturnState } from "@/lib/messageNavigation";
import {
  ListingMessageDialog,
  listingMessageRecipientFromProfile,
} from "@/components/ListingMessageDialog";
import { canMessageListingAgent as viewerCanMessageListingAgent, resolveListingAgentId } from "@/lib/canMessageListingAgent";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useSharedListingGuest } from "@/contexts/SharedListingGuestContext";
import ContactAgentDialog from "@/components/ContactAgentDialog";

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

/** Section shell aligned with polished browse / favorites surfaces */
const consumerSectionCard =
  "rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]";

function ConsumerPropertyDetailSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-3 pt-5">
        <Skeleton className="h-5 w-40 rounded-md bg-neutral-100" />
      </div>
      <div className={cn(propertyPageContainer, "pb-6")}>
        <div className={cn("flex flex-col", propertyHeroGap, "lg:flex-row")}>
          <div className={cn(propertyMediaCol, "space-y-4")}>
            <Skeleton className="h-[280px] w-full rounded-2xl bg-neutral-100 sm:h-[360px] lg:h-[440px]" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-[5.5rem] rounded-full bg-neutral-100" />
              <Skeleton className="h-9 w-[5.5rem] rounded-full bg-neutral-100" />
              <Skeleton className="ml-auto h-9 w-24 rounded-full bg-neutral-100" />
            </div>
            <Skeleton className="h-14 w-full max-w-xl rounded-lg bg-neutral-100" />
          </div>
          <div className={cn(propertyRailCol, propertyRailStack)}>
            <Skeleton className="h-72 rounded-2xl bg-neutral-100" />
            <Skeleton className="h-24 rounded-2xl bg-neutral-100" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-2">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-48 rounded-2xl bg-neutral-100" />
            <Skeleton className="h-64 rounded-2xl bg-neutral-100" />
            <Skeleton className="h-56 rounded-2xl bg-neutral-100" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl bg-neutral-100" />
            <Skeleton className="h-32 rounded-2xl bg-neutral-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [loadError, setLoadError] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'photos' | 'video' | 'tour' | 'website'>('photos');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [stickyAgentId, setStickyAgentId] = useState<string | null>(null);
  const [stickyAgentProfile, setStickyAgentProfile] = useState<AgentProfile | null>(null);
  const [listingContactDialogOpen, setListingContactDialogOpen] = useState(false);
  const [listingMessageOpen, setListingMessageOpen] = useState(false);
  const [listingMessageVariant, setListingMessageVariant] = useState<"agent" | "buyer">("buyer");
  const { user, role } = useAuthRole();
  const { registerGuestListing } = useSharedListingGuest();

  // Shared-listing guest mode: unauthenticated viewers anchor on this listing.
  useEffect(() => {
    if (user) return;
    if (!id) return;
    registerGuestListing(id);
  }, [user, id, registerGuestListing]);

  const isAgentView = role === "agent" || role === "admin";
  const viewerId = user?.id;
  const listingAgentId = resolveListingAgentId(listing, agentProfile);
  const canMessageListingAgent = viewerCanMessageListingAgent(viewerId, listingAgentId);

  const ensureSignedInForMessage = async (): Promise<boolean> => {
    if (!listing?.id) return false;

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("auth.getUser error:", error);
      toast.error("Could not verify your session. Please sign in again.");
      return false;
    }
    if (!data?.user?.id) {
      navigate("/auth");
      return false;
    }
    return true;
  };

  const openBuyerAgentMessage = () => {
    void (async () => {
      if (!(await ensureSignedInForMessage())) return;
      setListingMessageVariant("buyer");
      setListingMessageOpen(true);
    })();
  };

  const openListingAgentMessage = () => {
    void (async () => {
      if (!(await ensureSignedInForMessage())) return;
      setListingMessageVariant("agent");
      setListingMessageOpen(true);
    })();
  };

  const listingMessageRecipient =
    listingMessageVariant === "buyer" && stickyAgentProfile
      ? listingMessageRecipientFromProfile(stickyAgentProfile)
      : listingMessageVariant === "agent" && listingAgentId
        ? agentProfile
          ? listingMessageRecipientFromProfile(agentProfile)
          : { id: listingAgentId, name: "Listing Agent", headshotUrl: null }
        : null;

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
        .select("id, first_name, last_name, title, headshot_url, logo_url, company, office_name, social_links")
        .eq("id", agentId)
        .maybeSingle();
      setStickyAgentProfile(data as AgentProfile | null);
    });
  }, []);

  // Track listing view
  useListingView(id);

  const loadListing = useCallback(async () => {
    if (!id) return;
    try {
      setLoadError(false);
      setLoading(true);
      setAgentProfile(null);

      const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();

      if (error) throw error;

      if (!data) {
        setListing(null);
        return;
      }

      setListing({
        ...data,
        photos: Array.isArray(data.photos) ? (data.photos as any[]) : [],
      });

      if (data.agent_id) {
        const { data: profile } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, title, company, office_name, headshot_url, logo_url, social_links")
          .eq("id", data.agent_id)
          .maybeSingle();

        setAgentProfile(profile ? (profile as AgentProfile) : null);
      } else {
        setAgentProfile(null);
      }
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      setLoadError(true);
      setListing(null);
      setAgentProfile(null);
      toast.error("Failed to load property details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadListing();
  }, [loadListing]);

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
    if (tab === 'website') {
      if (listing?.property_website_url) {
        window.open(listing.property_website_url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    if (tab === 'video') {
      if (listing?.video_url) {
        window.open(listing.video_url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    if (tab === 'tour') {
      if (listing?.virtual_tour_url) {
        window.open(listing.virtual_tour_url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    setActiveMediaTab(tab);
    if (tab === 'photos') setCurrentPhotoIndex(0);
  };

  const handleExpandGallery = () => setGalleryOpen(true);

  const getStatusColor = (status: string) => {
    const config = getStatusConfig(status, "listing");
    return `${config.bg} ${config.text}`;
  };

  const getCompensationDisplay = () => formatBuyerAgentFeeDisplay(listing ?? {});

  if (loading) {
    return <ConsumerPropertyDetailSkeleton />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
          <div className="w-full rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <p className="text-[15px] font-semibold text-neutral-900">Couldn&apos;t load this listing</p>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
              Check your connection and try again.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" onClick={() => void loadListing()}>
                Try again
              </Button>
              <Button type="button" size="sm" variant="outline" className="border-neutral-200" onClick={() => navigate("/browse")}>
                Browse homes
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
          <div className="w-full rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <p className="text-[15px] font-semibold text-neutral-900">Listing not found</p>
            <p className="mt-2 text-[13px] text-neutral-500">It may have been removed or the link is incorrect.</p>
            <div className="mt-6 flex justify-center">
              <Button type="button" onClick={() => navigate("/browse")}>
                Back to search
              </Button>
            </div>
          </div>
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

  const listingPriceDisplay = formatListingPriceDisplay(listing) ?? "—";

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
      <BuyerAgentFeeDetail feeDisplay={compensationDisplay} commissionNotes={listing.commission_notes} />
    );

  return (
    <div className="min-h-screen bg-white">
      <PropertyMetaTags
        address={listing.address}
        city={listing.city}
        state={listing.state}
        priceDisplay={listingPriceDisplay}
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
        <AacBackButton
          type="button"
          onClick={() => {
            const p = new URLSearchParams(location.search);
            const st = (location.state as { from?: string } | null)?.from;
            const returnTo = p.get("returnTo");
            if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
              navigate(returnTo);
              return;
            }
            if (p.get("from") === "favorites" || st === "/client/favorites" || st === "/favorites") {
              navigate("/favorites");
              return;
            }
            if (typeof st === "string" && st.startsWith("/") && !st.startsWith("//")) {
              navigate(st);
              return;
            }
            const lastSearch = sessionStorage.getItem("buyer_last_search_url");
            navigate(lastSearch || "/client/dashboard");
          }}
          className="text-[13px]"
        />
      </div>

      <div className="flex-1">
        {/* ========== TWO-COLUMN GRID (68% / 32%) ========== */}
        <div className={cn(propertyPageContainer, "pb-8")}>
          <div
            className={cn(
              "grid grid-cols-1 gap-y-6",
              "lg:grid-cols-[68%_32%] lg:items-start lg:gap-x-6 lg:gap-y-0",
            )}
          >
            {/* Row 1 — address + price (left column only) */}
            <PropertyHeader
              embedded
              address={buildDisplayAddress(listing as any)}
              priceDisplay={listingPriceDisplay}
              priceSuffix={listing.listing_type === 'for_rent' ? '/ mo' : undefined}
              className="order-1 mb-6 min-w-0 lg:col-start-1 lg:row-start-1 lg:mb-8"
            />

            {/* Row 2 — photo (left column) */}
            <div className="order-2 min-w-0 lg:col-start-1 lg:row-start-2">
              <div
                className={cn(
                  propertyHeroMedia,
                  "h-[280px] shadow-md ring-1 ring-neutral-200/90 sm:h-[360px] lg:h-[440px]",
                )}
              >
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

                  {/* Status Badge - Top Left (NO AAC# for consumer view) */}
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <Badge className={`${getStatusColor(listing.status)} bg-white/90 backdrop-blur-sm`}>
                      {getStatusConfig(listing.status, "listing").label}
                    </Badge>
                  </div>

                  {/* Favorite - Top Right (buyers/guests only) */}
                  {!isAgentView && (
                    <div
                      className="absolute top-3 right-3 z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FavoriteButton listingId={listing.id} size="icon" photoIcon />
                    </div>
                  )}

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

                  {/* Neighborhood — bottom left */}
                  {activeMediaTab === "photos" && neighborhoodLabel && (
                    <div className="absolute bottom-4 left-4 z-10 max-w-[min(100%,20rem)]">
                      <span className="inline-flex max-w-full rounded-full border border-white/70 bg-black/85 px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-md">
                        {neighborhoodLabel}
                      </span>
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

              {/* Anchored under photo — inset matches neighborhood pill (left-4) */}
              <div className={cn(propertyPhotoContentInset, "flex flex-col gap-3 pt-1")}>
                <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <MediaTabBar
                    active={activeMediaTab as MediaTab}
                    onChange={(tab) => handleMediaTabChange(tab)}
                    hasVideo={!!listing.video_url}
                    hasTour={!!listing.virtual_tour_url}
                    hasWebsite={!!listing.property_website_url}
                    neutralTone
                    className="!mt-0 min-w-0 !px-0"
                    trailing={
                      <SocialShareMenu
                        url={getListingShareUrl(id!)}
                        title={listing.address}
                        description={listing.description || ""}
                        listingId={id!}
                        listingAddress={listing.address}
                        senderProfileSource="buyer"
                        trigger={
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-neutral-200 bg-white text-[13px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
                            aria-label="Share property"
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                          </Button>
                        }
                      />
                    }
                  />
                </div>

                <PropertyFactsRow
                  bedrooms={listing.bedrooms}
                  bathrooms={listing.bathrooms}
                  squareFeet={listing.square_feet}
                  totalParkingSpaces={
                    listing.total_parking_spaces ?? listing.garage_spaces ?? null
                  }
                  daysOnMarket={daysOnMarket}
                  containerClassName="mt-4"
                />
              </div>
            </div>

            {/* Row 3 — overview, details (left column) */}
            <div
              className={cn(
                propertyPhotoContentInset,
                "order-3 flex min-w-0 flex-col gap-5 pt-8 lg:col-start-1 lg:row-start-3",
              )}
            >
              {/* Overview/Description with Read More */}
              {listing.description && (() => {
                const MAX_CHARS = 650;
                const full = listing.description || '';
                const isLong = full.length > MAX_CHARS;
                const visibleText = !isLong || descriptionExpanded ? full : `${full.slice(0, MAX_CHARS)}…`;

                return (
                  <SectionWrapper
                    title="Overview"
                    icon={<FileText className="h-5 w-5 text-neutral-600" />}
                    headerClassName="!pt-7"
                    contentClassName="space-y-4"
                    className={consumerSectionCard}
                  >
                    <p className="whitespace-pre-wrap text-neutral-800">{visibleText}</p>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => setDescriptionExpanded(v => !v)}
                        className="text-sm font-medium text-neutral-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300/50"
                      >
                        {descriptionExpanded ? 'Read less' : 'Read more'}
                      </button>
                    )}
                  </SectionWrapper>
                );
              })()}

              <ListingDetailSections
                listing={listing}
                agent={agentProfile}
                isAgentView={false}
                premiumNeutralSurfaces
              />

              {stickyAgentProfile && agentProfile && agentProfile.id !== stickyAgentProfile.id && (
                <p className="px-1 text-xs text-neutral-500">
                  Listing courtesy of {agentProfile.first_name} {agentProfile.last_name}
                  {agentProfile.company ? ` • ${agentProfile.company}` : ""}
                </p>
              )}

              <SectionWrapper
                title="Location"
                icon={<MapPin className="h-5 w-5 text-neutral-600" />}
                className={consumerSectionCard}
              >
                <PropertyMap
                  address={`${listing.address}, ${listing.city}, ${listing.state} ${listing.zip_code}`}
                  latitude={listing.latitude}
                  longitude={listing.longitude}
                />
              </SectionWrapper>
            </div>

            {/* Row 2+ — agent rail (right column, top aligned with photo) */}
            <div
              className={cn(
                propertyRailStack,
                propertyRailSticky,
                "order-4 min-w-0 lg:col-start-2 lg:row-start-2 lg:self-start",
              )}
            >

              <div className={propertyDetailRailActionGroup}>
              {/* Agent/admin: listing agent contact via AAC email (no buyer CTAs) */}
              {isAgentView && (agentProfile || listing?.agent_id) ? (
                <Card className={cn(consumerSectionCard, "shadow-sm")}>
                  <CardContent className={propertyDetailAgentCardContent}>
                    <div className="flex items-center gap-4">
                      <AgentAvatar
                        name={
                          agentProfile
                            ? `${agentProfile.first_name} ${agentProfile.last_name}`
                            : "Listing Agent"
                        }
                        headshotUrl={agentProfile?.headshot_url ?? null}
                        userId={agentProfile?.id ?? listing.agent_id}
                        size="xl"
                        avatarClassName={propertyDetailAgentAvatar}
                        fallbackClassName="bg-neutral-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={propertyDetailAgentEyebrow}>Listing agent</p>
                        <p className="mt-1 font-bold text-lg leading-tight">
                          {agentProfile
                            ? `${agentProfile.first_name} ${agentProfile.last_name}`
                            : "Listing Agent"}
                        </p>
                        {agentProfile && (
                          <div className={cn(propertyDetailAgentTitleBlock, "mt-0.5")}>
                            <p className="text-sm text-neutral-600">
                              {agentProfile.title || "Realtor"}
                            </p>
                            {(agentProfile.company || agentProfile.office_name) && (
                              <p className="text-sm text-muted-foreground">
                                {agentProfile.company || agentProfile.office_name}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={propertyDetailAgentContactRows}>
                      {agentProfile?.cell_phone && (
                        <a href={`tel:${agentProfile.cell_phone}`} className="flex items-center gap-2.5 transition-colors hover:text-neutral-900">
                          <Phone className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.cell_phone)}</span>
                          <span className="ml-auto text-xs text-neutral-500">Mobile</span>
                        </a>
                      )}
                      {agentProfile?.phone && agentProfile.phone !== agentProfile.cell_phone && (
                        <a href={`tel:${agentProfile.phone}`} className="flex items-center gap-2.5 transition-colors hover:text-neutral-900">
                          <Building2 className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.phone)}</span>
                          <span className="ml-auto text-xs text-neutral-500">Office</span>
                        </a>
                      )}
                      {agentProfile?.email && (
                        <button
                          type="button"
                          onClick={() => setListingContactDialogOpen(true)}
                          className="flex w-full items-center gap-2.5 text-left transition-colors hover:text-neutral-900"
                        >
                          <Mail className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium truncate">{agentProfile.email}</span>
                        </button>
                      )}
                    </div>

                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full gap-2 border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
                      onClick={() => setListingContactDialogOpen(true)}
                    >
                      <Mail className="h-4 w-4" />
                      Email listing agent
                    </Button>

                    {canMessageListingAgent && (
                      <Button
                        className={cn(propertyDetailMessageCtaBase, propertyDetailMessageCta)}
                        onClick={openListingAgentMessage}
                      >
                        <MessageSquare />
                        Message Agent
                      </Button>
                    )}

                    <ContactAgentDialog
                      listingId={listing.id}
                      agentId={listing.agent_id}
                      listingAddress={formatListingEmailSubjectLocation(listing) || `${listing.address}, ${listing.city}, ${listing.state}`}
                      open={listingContactDialogOpen}
                      onOpenChange={setListingContactDialogOpen}
                      hideTrigger
                    />
                  </CardContent>
                </Card>
              ) : stickyAgentProfile ? (
                <Card className={cn(consumerSectionCard, "shadow-sm")}>
                  <CardContent className={propertyDetailAgentCardContent}>
                    <div className="flex items-center gap-4">
                      <AgentAvatar
                        name={`${stickyAgentProfile.first_name} ${stickyAgentProfile.last_name}`}
                        headshotUrl={stickyAgentProfile.headshot_url ?? null}
                        userId={stickyAgentProfile.id}
                        size="xl"
                        avatarClassName={propertyDetailAgentAvatar}
                        fallbackClassName="bg-neutral-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={propertyDetailAgentEyebrow}>Your agent</p>
                        <p className="mt-1 font-bold text-lg leading-tight">
                          {stickyAgentProfile.first_name} {stickyAgentProfile.last_name}
                        </p>
                        <div className={cn(propertyDetailAgentTitleBlock, "mt-0.5")}>
                          <p className="text-sm text-neutral-600">
                            {stickyAgentProfile.title || "Realtor"}
                          </p>
                          {(stickyAgentProfile.company || stickyAgentProfile.office_name) && (
                            <p className="text-sm text-muted-foreground">
                              {stickyAgentProfile.company || stickyAgentProfile.office_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={propertyDetailAgentContactRows}>
                      {stickyAgentProfile.cell_phone && (
                        <a href={`tel:${stickyAgentProfile.cell_phone}`} className="flex items-center gap-2.5 transition-colors hover:text-neutral-900">
                          <Phone className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(stickyAgentProfile.cell_phone)}</span>
                          <span className="ml-auto text-xs text-neutral-500">Mobile</span>
                        </a>
                      )}
                      {stickyAgentProfile.phone && stickyAgentProfile.phone !== stickyAgentProfile.cell_phone && (
                        <a href={`tel:${stickyAgentProfile.phone}`} className="flex items-center gap-2.5 transition-colors hover:text-neutral-900">
                          <Building2 className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(stickyAgentProfile.phone)}</span>
                          <span className="ml-auto text-xs text-neutral-500">Office</span>
                        </a>
                      )}
                      {stickyAgentProfile.email && (
                        <a href={`mailto:${stickyAgentProfile.email}`} className="flex items-center gap-2.5 transition-colors hover:text-neutral-900">
                          <Mail className="h-4 w-4 shrink-0 text-[#0E56F5]" aria-hidden strokeWidth={2} />
                          <span className="font-medium truncate">{stickyAgentProfile.email}</span>
                        </a>
                      )}
                      {stickyAgentProfile.social_links?.website && (
                        <a
                          href={stickyAgentProfile.social_links.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 font-medium text-neutral-800 underline-offset-2 hover:text-neutral-900 hover:underline"
                        >
                          <Globe className="h-4 w-4 shrink-0 text-neutral-600" />
                          <span className="font-medium">Website</span>
                        </a>
                      )}
                    </div>

                    {/* ATTRIBUTION MASKING: Primary contact action is in-app messaging only.
                        Do not re-add email form (ContactAgentDialog) as buyer CTA. */}
                    <Button
                      className={cn(propertyDetailMessageCtaBase, propertyDetailMessageCta)}
                      onClick={openBuyerAgentMessage}
                    >
                      <MessageSquare />
                      Message your agent
                    </Button>
                  </CardContent>
                </Card>
              ) : agentProfile ? (
                <Card className={cn(consumerSectionCard, "shadow-sm")}>
                  <CardContent className={propertyDetailAgentCardContent}>
                    <div className="flex items-center gap-4">
                      <AgentAvatar
                        name={`${agentProfile.first_name} ${agentProfile.last_name}`}
                        headshotUrl={agentProfile.headshot_url ?? null}
                        userId={agentProfile.id}
                        size="xl"
                        avatarClassName={propertyDetailAgentAvatar}
                        fallbackClassName="bg-neutral-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={propertyDetailAgentEyebrow}>Listing agent</p>
                        <p className="mt-1 font-bold text-lg leading-tight">
                          {agentProfile.first_name} {agentProfile.last_name}
                        </p>
                        <div className={cn(propertyDetailAgentTitleBlock, "mt-0.5")}>
                          <p className="text-sm text-neutral-600">
                            {agentProfile.title || "Realtor"}
                          </p>
                          {(agentProfile.company || agentProfile.office_name) && (
                            <p className="text-sm text-muted-foreground">
                              {agentProfile.company || agentProfile.office_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={propertyDetailAgentContactRows}>
                      {agentProfile.cell_phone && (
                        <a href={`tel:${agentProfile.cell_phone}`} className="flex items-center gap-2.5 transition-colors hover:text-neutral-900">
                          <Phone className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.cell_phone)}</span>
                          <span className="ml-auto text-xs text-neutral-500">Mobile</span>
                        </a>
                      )}
                      {agentProfile.phone && agentProfile.phone !== agentProfile.cell_phone && (
                        <a href={`tel:${agentProfile.phone}`} className="flex items-center gap-2.5 transition-colors hover:text-neutral-900">
                          <Building2 className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.phone)}</span>
                          <span className="ml-auto text-xs text-neutral-500">Office</span>
                        </a>
                      )}
                      {agentProfile.email && (
                        <a href={`mailto:${agentProfile.email}`} className="flex items-center gap-2.5 transition-colors hover:text-neutral-900">
                          <Mail className="h-4 w-4 shrink-0 text-[#0E56F5]" aria-hidden strokeWidth={2} />
                          <span className="font-medium truncate">{agentProfile.email}</span>
                        </a>
                      )}
                      {agentProfile.social_links?.website && (
                        <a
                          href={agentProfile.social_links.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 font-medium text-neutral-800 underline-offset-2 hover:text-neutral-900 hover:underline"
                        >
                          <Globe className="h-4 w-4 shrink-0 text-neutral-600" />
                          <span className="font-medium">Website</span>
                        </a>
                      )}
                    </div>

                    {canMessageListingAgent && (
                      <Button
                        className={cn(propertyDetailMessageCtaBase, propertyDetailMessageCta)}
                        onClick={openListingAgentMessage}
                      >
                        <MessageSquare />
                        Message Agent
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className={cn(consumerSectionCard, "shadow-sm")}>
                  <CardContent className={propertyDetailAgentCardContent}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm">
                        <HelpCircle className="h-8 w-8 text-neutral-400" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Need help?</p>
                        <p className="text-lg font-bold leading-tight text-neutral-900">Contact support</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!isAgentView && (
                <div className="px-6">
                  <ScheduleShowingDialog
                    listingId={listing.id}
                    listingAddress={formatListingEmailSubjectLocation(listing) || `${listing.address}, ${listing.city}, ${listing.state}`}
                    triggerVariant="outline"
                    triggerClassName={cn(propertyDetailScheduleCtaBase, propertyDetailScheduleCta)}
                  />
                </div>
              )}
              </div>

              {buyerCompensationCard}

              <div className="space-y-6 pt-2">
              {/* Buyer Agent Showcase — only when buyer is unrepresented.
                  Represented buyers already have a sticky agent. */}
              {!stickyAgentProfile && (
                <BuyerAgentShowcase
                  listingZip={listing.zip_code}
                  listingId={listing.id}
                />
              )}

              {/* ATTOM Property Data */}
              {listing.attom_data && Object.keys(listing.attom_data).length > 0 && (() => {
                const attomPropertyType = formatConsumerPropertyTypeLabel(listing.attom_data.property_type);
                return (
                <SectionWrapper title="Property Data" contentClassName="space-y-2" className={consumerSectionCard}>
                  {attomPropertyType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Property Type:</span>
                      <span className="font-semibold">{attomPropertyType}</span>
                    </div>
                  )}
                  {listing.attom_data.stories && (
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Stories:</span>
                      <span className="font-semibold">{listing.attom_data.stories}</span>
                    </div>
                  )}
                  {listing.attom_data.parking_spaces && (
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Parking Spaces:</span>
                      <span className="font-semibold">{listing.attom_data.parking_spaces}</span>
                    </div>
                  )}
                  {listing.attom_data.zoning && (
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Zoning:</span>
                      <span className="font-semibold">{listing.attom_data.zoning}</span>
                    </div>
                  )}
                </SectionWrapper>
                );
              })()}

              {/* Schools */}
              {listing.schools_data && listing.schools_data.schools && listing.schools_data.schools.length > 0 && (
                <SectionWrapper
                  title="Nearby Schools"
                  icon={<GraduationCap className="h-5 w-5 text-neutral-600" />}
                  contentClassName="space-y-3"
                  className={consumerSectionCard}
                >
                  {listing.schools_data.schools.slice(0, 5).map((school: any, index: number) => (
                    <div key={index} className="pb-3 border-b last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-sm">{school.name}</h4>
                        {school.rating && <Badge variant="secondary">{school.rating}/10</Badge>}
                      </div>
                      <p className="text-xs text-neutral-500">{school.level} • {school.distance} mi</p>
                    </div>
                  ))}
                </SectionWrapper>
              )}

              {/* Walk Score */}
              {listing.walk_score_data && (
                <SectionWrapper
                  title="Walk Score"
                  icon={<Footprints className="h-5 w-5 text-neutral-600" />}
                  contentClassName="space-y-3"
                  className={consumerSectionCard}
                >
                  {listing.walk_score_data.walkscore && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm">Walk Score</span>
                        <span className="text-2xl font-bold tabular-nums text-neutral-900">{listing.walk_score_data.walkscore}</span>
                      </div>
                      <p className="text-xs text-neutral-500">{listing.walk_score_data.description}</p>
                    </div>
                  )}
                  {listing.walk_score_data.transit && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Transit Score</span>
                        <span className="text-xl font-bold tabular-nums text-neutral-900">{listing.walk_score_data.transit.score}</span>
                      </div>
                    </div>
                  )}
                  {listing.walk_score_data.bike && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Bike Score</span>
                        <span className="text-xl font-bold tabular-nums text-neutral-900">{listing.walk_score_data.bike.score}</span>
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

      {listing && (
        <ListingMessageDialog
          open={listingMessageOpen}
          onOpenChange={setListingMessageOpen}
          listingId={listing.id}
          variant={listingMessageVariant}
          recipient={listingMessageRecipient}
          role={role}
          returnState={buildMessageReturnState(location.pathname, location.search)}
        />
      )}
    </div>
  );
};

export default ConsumerPropertyDetail;
