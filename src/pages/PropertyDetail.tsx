import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, useNavigationType } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// Navigation removed - rendered globally in App.tsx
import { LoadingScreen } from "@/components/LoadingScreen";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { getStatusConfig } from "@/constants/status";
import {
  MapPin, 
  Phone,
  Mail,
  Share2,
  Eye,
  EyeOff,
  FileText,
  ChevronLeft,
  ChevronRight,
  Globe,
  Expand,
  Edit2,
  Send,
  KeyRound,
  ClipboardList,
  Activity,
  Copy,
  Building2,
  Users,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { formatListingPropertyTypeLabel } from "@/lib/format";
import { formatListingEmailSubjectLocation } from "@/lib/listingEmailSubject";
import {
  listingAgreementDisclosuresTitle,
  listingAgreementSectionTitle,
} from "@/lib/listingAgreement";
import { buildDisplayAddress, cn } from "@/lib/utils";

const listingDetailPrimaryCtaClass =
  "bg-[#0E56F5] text-white hover:bg-[#0B46CC] focus-visible:ring-[#0E56F5]/35";
const listingDetailOutlineCtaClass =
  "border-[#0E56F5]/30 text-[#0E56F5] hover:bg-[#0E56F5]/5 hover:text-[#0B46CC]";
import { useListingView } from "@/hooks/useListingView";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useSharedListingGuest } from "@/contexts/SharedListingGuestContext";
import { usePropertyDetailRailPosition } from "@/hooks/usePropertyDetailRailPosition";
import { PropertyMetaTags } from "@/components/PropertyMetaTags";
import { Seo } from "@/components/Seo";
import { getPublicOrigin } from "@/lib/getPublicUrl";
import { ListingDetailSections } from "@/components/ListingDetailSections";
import { PropertyHeader } from "@/components/property/PropertyHeader";
import { BuyerAgentFeeDetail, formatBuyerAgentFeeDisplay } from "@/components/property/BuyerAgentFeeDetail";
import { PropertyFactsRow, propertyPhotoContentInset } from "@/components/property/PropertyFactsRow";
import { MediaTabBar, type MediaTab } from "@/components/property/MediaTabBar";
import { SectionWrapper } from "@/components/property/SectionWrapper";
import {
  propertyPageContainer,
  propertyPageContainerAgentWorkspace,
  propertyHeroMedia,
  propertyRailStack,
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
import { BuyerAgentShowcase } from "@/components/BuyerAgentShowcase";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import PhotoGalleryDialog from "@/components/PhotoGalleryDialog";
import SocialShareMenu from "@/components/SocialShareMenu";
import ScheduleShowingDialog from "@/components/ScheduleShowingDialog";
import FavoriteButton from "@/components/FavoriteButton";
import PropertyMap from "@/components/PropertyMap";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";
import { formatListingPriceDisplay, listingEffectiveNumericPrice } from "@/lib/formatListingPriceDisplay";
import { parseDisclosures, cleanBrokerComments, isEmptyValue } from "@/lib/listingFieldParsers";
import { buildMessageReturnState } from "@/lib/messageNavigation";
import {
  ListingMessageDialog,
  listingMessageRecipientFromProfile,
} from "@/components/ListingMessageDialog";
import {
  canMessageListingAgent as viewerCanMessageListingAgent,
  resolveListingAgentId,
} from "@/lib/canMessageListingAgent";

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
  price_range_min?: number | null;
  price_range_max?: number | null;
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
  annual_property_tax?: number | null;
  tax_assessment_value?: number | null;
  neighborhood?: string | null;
  walk_score_data?: any;
  garage_spaces?: number | null;
  total_parking_spaces?: number | null;
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

interface ListingPriceHistoryItem {
  id: string;
  changed_at: string;
  new_price: number;
  old_price: number | null;
  note: string | null;
}

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [stats, setStats] = useState({ matches: 0, views: 0 });
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'photos' | 'video' | 'tour' | 'website'>('photos');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [listingMessageOpen, setListingMessageOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState<ListingPriceHistoryItem[]>([]);

  // Role detection + URL-based client mode
  const { user, role, loading: roleLoading } = useAuthRole();
  const { registerGuestListing } = useSharedListingGuest();

  // Shared-listing guest mode: when an unauthenticated visitor lands on a
  // listing page (typically from a shared Facebook/Twitter/etc link), record
  // this listing as the one they're allowed to view freely. First-write wins.
  useEffect(() => {
    if (roleLoading) return;
    if (user) return;
    if (!id) return;
    registerGuestListing(id);
  }, [roleLoading, user, id, registerGuestListing]);

  const railPositionEnabled = !loading && !fetchError && !!listing;
  const { layoutRef, anchorRef, panelRef, panelStyle } =
    usePropertyDetailRailPosition(railPositionEnabled);
  const isAgent = role === "agent";
  const isAdmin = role === "admin";
  const isBuyer = role === "buyer";

  /** Buyers, guests, and any non-agent role use the buyer-safe consumer detail route. */
  const shouldUseConsumerDetail = !roleLoading && !isAgent && !isAdmin;

  useEffect(() => {
    if (shouldUseConsumerDetail && id) {
      const q = location.search;
      navigate(`/consumer-property/${id}${q}`, { replace: true, state: location.state });
    }
  }, [shouldUseConsumerDetail, id, navigate, location]);

  // Check for client mode via URL query param or path suffix
  const searchParams = new URLSearchParams(location.search);
  const isClientMode = searchParams.get('view') === 'client' || location.pathname.endsWith('/client');
  const isAgentView = (isAgent || isAdmin) && !isClientMode;

  const viewerId = user?.id;
  const listingAgentId = resolveListingAgentId(listing, agentProfile);
  const canMessageListingAgent = viewerCanMessageListingAgent(viewerId, listingAgentId);

  const isListingOwner =
    isAgentView && !!viewerId && !!listing?.agent_id && viewerId === listing.agent_id;

  /** In-app return path only (blocks protocol-relative `//`). */
  const isSafeInternalReturnPath = (path: string) =>
    path.startsWith("/") && !path.startsWith("//");

  /**
   * `/property/:id` is shared; back must never send agents to buyer routes by default.
   * Prefer explicit `location.state.from`, then history when stacked via PUSH, else role fallback.
   */
  const handlePropertyDetailBack = () => {
    const params = new URLSearchParams(location.search);
    const locationState = location.state as {
      from?: string;
      returnedFromAgentProfile?: boolean;
    } | null;
    const st = locationState?.from;

    if (params.get("from") === "favorites" || st === "/client/favorites" || st === "/favorites") {
      navigate("/favorites");
      return;
    }
    if (st === "/client/search") {
      navigate("/client/search");
      return;
    }
    if (typeof st === "string" && isSafeInternalReturnPath(st)) {
      navigate(st);
      return;
    }
    if (
      (isAgent || isAdmin) &&
      navigationType === "PUSH" &&
      !locationState?.returnedFromAgentProfile
    ) {
      navigate(-1);
      return;
    }
    if (isAgent || isAdmin) {
      navigate("/listing-results");
      return;
    }
    if (isBuyer) {
      navigate("/client/dashboard");
      return;
    }
    navigate("/browse");
  };

  const openListingMessage = () => {
    if (!viewerId) {
      navigate("/auth");
      return;
    }
    if (!listingAgentId) {
      toast.error("No listing agent is available to message.");
      return;
    }
    setListingMessageOpen(true);
  };

  // Track listing view
  useListingView(id);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        setFetchError(false);
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
              .select(
                "id, first_name, last_name, title, company, headshot_url, logo_url, social_links, email, phone, cell_phone, aac_id",
              )
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
        } else {
          setListing(null);
        }
      } catch (error: any) {
        console.error("Error fetching listing:", error);
        setFetchError(true);
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchListing();
    } else {
      setLoading(false);
      setListing(null);
    }
  }, [id]);

  useEffect(() => {
    if (!listing?.id) return;

    let cancelled = false;

    const fetchPriceHistory = async () => {
      const { data } = await supabase
        .from("listing_price_history")
        .select("id, changed_at, new_price, old_price, note")
        .eq("listing_id", listing.id)
        .order("changed_at", { ascending: false })
        .limit(8);

      if (!cancelled) {
        setPriceHistory((data || []) as ListingPriceHistoryItem[]);
      }
    };

    void fetchPriceHistory();

    return () => {
      cancelled = true;
    };
  }, [listing?.id]);


  const handlePrint = () => {
    window.print();
  };

  const handleExpandGallery = () => {
    setGalleryOpen(true);
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
    const config = getStatusConfig(status, "listing");
    return `${config.bg} ${config.text}`;
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

  const getCompensationDisplay = () => formatBuyerAgentFeeDisplay(listing ?? {});

  if (roleLoading || shouldUseConsumerDetail) {
    return <LoadingScreen />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-white pt-16 sm:pt-20">
        <div className="mx-auto max-w-lg px-4 py-10">
          <Card className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CardContent className="space-y-4 py-10 text-center">
              <p className="text-[15px] font-medium text-neutral-900">Couldn&apos;t load this listing</p>
              <p className="text-sm text-neutral-500">Check your connection and try again.</p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button variant="outline" className="border-neutral-200" onClick={() => window.location.reload()}>
                  Try again
                </Button>
                <Button variant="outline" className="border-neutral-200" onClick={() => navigate("/browse")}>
                  Browse homes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-white pt-16 sm:pt-20">
        <div className="mx-auto max-w-lg px-4 py-10">
          <Card className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CardContent className="space-y-4 py-10">
              <p className="text-center text-[15px] text-neutral-600">Listing not found</p>
              <p className="text-center text-sm text-neutral-500">
                This property may be unavailable or the link may be incorrect.
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" className="border-neutral-200" onClick={() => navigate("/browse")}>
                  Browse homes
                </Button>
                <Button variant="outline" className="border-neutral-200" onClick={() => navigate("/")}>
                  Home
                </Button>
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

  const compensationDisplay = getCompensationDisplay();

  const listingPriceDisplay = formatListingPriceDisplay(listing) ?? "—";

  const listDate = listing.active_date || listing.created_at;
  const daysOnMarket = listDate
    ? Math.ceil((new Date().getTime() - new Date(listDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const neighborhoodLabel =
    typeof listing.neighborhood === "string" && listing.neighborhood.trim()
      ? listing.neighborhood.trim()
      : null;

  /** Premium neutral section shell (matches listing search results). */
  const detailSurface =
    "rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]";
  const consumerSectionCard =
    "rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]";

  const buyerCompensationCard =
    compensationDisplay && (
      <BuyerAgentFeeDetail
        feeDisplay={compensationDisplay}
        commissionNotes={listing.commission_notes}
      />
    );
  return (
    <div className="min-h-screen overflow-visible bg-white pt-0">
      <Seo
        title={`${listing.address}, ${listing.city}, ${listing.state}`}
        description={
          listing.description
            ? `${listingPriceDisplay} — ${listing.bedrooms ?? "—"} bed, ${listing.bathrooms ?? "—"} bath. ${listing.description.substring(0, 120)}…`
            : `${listingPriceDisplay} — ${listing.bedrooms ?? "—"} bed, ${listing.bathrooms ?? "—"} bath in ${listing.city}, ${listing.state}`
        }
        image={mainPhoto || undefined}
        canonical={`${getPublicOrigin()}/property/${id}`}
        type="website"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "RealEstateListing",
          name: `${listing.address}, ${listing.city}, ${listing.state}`,
          url: `${getPublicOrigin()}/property/${id}`,
          description: listing.description || undefined,
          ...(mainPhoto ? { image: mainPhoto } : {}),
          offers: {
            "@type": "Offer",
            price: listingEffectiveNumericPrice(listing) ?? undefined,
            priceCurrency: "USD",
          },
          address: {
            "@type": "PostalAddress",
            streetAddress: listing.address,
            addressLocality: listing.city,
            addressRegion: listing.state,
            postalCode: listing.zip_code,
          },
        }}
      />


      <main className="flex-1 overflow-visible">
        {/* Back Button Row */}
        <div className={cn(isAgentView ? propertyPageContainerAgentWorkspace : propertyPageContainer)}>
          <AacPageIntro
            withTopPadding
            back={<AacBackButton type="button" onClick={handlePropertyDetailBack} />}
          />
        </div>

        {/* Full-page two-column layout; rail pinned on desktop via anchor + fixed panel */}
        <div
          ref={layoutRef}
          className={cn(
            isAgentView ? propertyPageContainerAgentWorkspace : propertyPageContainer,
            "overflow-visible pb-8",
          )}
        >
          <div
            className={cn(
              "grid grid-cols-1 gap-y-6 overflow-visible",
              "lg:grid-cols-[68%_32%] lg:items-start lg:gap-x-6 lg:gap-y-0",
            )}
          >
            {/* Row 1 — address + price */}
            {/* Desktop: address (left) + price (right) above photo */}
            <PropertyHeader
              embedded
              address={buildDisplayAddress(listing as any)}
              priceDisplay={listingPriceDisplay}
              priceSuffix={listing.listing_type === "for_rent" ? "/ mo" : undefined}
              className="order-1 mb-6 hidden min-w-0 lg:col-start-1 lg:row-start-1 lg:mb-8 lg:block"
            />
            {/* Mobile: price only, left-aligned, tight above photo */}
            <div className="order-1 min-w-0 lg:hidden">
              <p className="text-lg font-bold tabular-nums text-foreground">
                {listingPriceDisplay ?? "—"}
                {listing.listing_type === "for_rent" && (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/ mo</span>
                )}
              </p>
            </div>

            {/* Row 2 — photo */}
            <div className="order-2 -mt-5 min-w-0 lg:mt-0 lg:col-start-1 lg:row-start-2">
              <div
                className={cn(
                  propertyHeroMedia,
                  "h-[280px] shadow-md ring-1 ring-neutral-200/90 sm:h-[360px] lg:h-[440px]",
                )}
              >
                <div className="absolute inset-0 bg-neutral-950">
                  {activeMediaTab === "photos" && (
                    <img
                      src={mainPhoto}
                      alt={listing.address}
                      className="h-full w-full cursor-pointer object-cover"
                      onClick={handleExpandGallery}
                    />
                  )}
                  {activeMediaTab === "video" && listing.video_url && (
                    <iframe
                      src={listing.video_url}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                  {activeMediaTab === "tour" && listing.virtual_tour_url && (
                    <iframe
                      src={listing.virtual_tour_url}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}

                  {/* Status Badge - Top Left Overlay */}
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <Badge className={`${getStatusColor(listing.status ?? "")} bg-white/90 backdrop-blur-sm`}>
                      {listing.status
                        ? getStatusConfig(listing.status, "listing").label
                        : "—"}
                    </Badge>
                  </div>

                  {!isAgentView && (
                    <div
                      className="absolute right-3 top-3 z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FavoriteButton listingId={listing.id} size="icon" photoIcon />
                    </div>
                  )}

                  {activeMediaTab === "photos" && listing.photos && listing.photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevPhoto}
                        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm transition-all hover:bg-black/70"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextPhoto}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm transition-all hover:bg-black/70"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}

                  {activeMediaTab === "photos" && neighborhoodLabel && (
                    <div className="absolute bottom-4 left-4 z-10 max-w-[min(100%,20rem)]">
                      <span className="inline-flex max-w-full rounded-full border border-white/70 bg-black/85 px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-md">
                        {neighborhoodLabel}
                      </span>
                    </div>
                  )}

                  {activeMediaTab === "photos" && (
                    <button
                      type="button"
                      onClick={handleExpandGallery}
                      className="absolute bottom-4 right-4 z-20 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-all hover:bg-black/70"
                      aria-label="Expand gallery"
                    >
                      <Expand className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className={cn(propertyPhotoContentInset, "flex flex-col gap-3 pt-1")}>
                <div className="flex w-full flex-row items-start justify-between gap-3 sm:items-center sm:gap-4">
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
                        senderProfileSource="agent"
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
                  {isAgentView && listing.listing_number ? (
                    <p className="shrink-0 self-start text-right text-sm leading-none text-neutral-900 sm:self-auto">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                        ID
                      </span>
                      <span className="ml-1.5 font-mono font-semibold tabular-nums text-[#0E56F5]">
                        #{listing.listing_number}
                      </span>
                    </p>
                  ) : null}
                </div>

                {/* Mobile-only address, sits directly above the facts row */}
                <div className="mt-3 flex items-baseline gap-1.5 lg:hidden">
                  <MapPin
                    className="relative top-[1px] h-3.5 w-3.5 shrink-0 text-[#50C878]"
                    aria-hidden
                    strokeWidth={2}
                  />
                  <h1 className="min-w-0 text-lg font-semibold tracking-tight text-foreground">
                    {buildDisplayAddress(listing as any)}
                  </h1>
                </div>

                <PropertyFactsRow
                  propertyTypeLabel={formatListingPropertyTypeLabel(listing.property_type)}
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

            {/* Row 3 — overview, details, map, agent tools */}
            <div
              className={cn(
                propertyPhotoContentInset,
                "order-3 flex min-w-0 flex-col gap-5 pt-7 lg:col-start-1 lg:row-start-3",
              )}
            >
              {listing.description && (() => {
                const MAX_CHARS = 650;
                const full = listing.description || "";
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
                        onClick={() => setDescriptionExpanded((v) => !v)}
                        className="text-sm font-medium text-neutral-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300/50"
                      >
                        {descriptionExpanded ? "Read less" : "Read more"}
                      </button>
                    )}
                  </SectionWrapper>
                );
              })()}

              {/* MLS-Style Detail Sections */}
              <ListingDetailSections 
                listing={listing} 
                agent={agentProfile}
                isAgentView={isAgentView}
                premiumNeutralSurfaces
              />

              {(listing.latitude || listing.longitude) && (
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
              )}

              {!isAgentView && (
                <div className="space-y-6">
                  <BuyerAgentShowcase listingZip={listing.zip_code} listingId={listing.id} />
                </div>
              )}

              {isAgentView && (
                <div id="agent-tools-section" className="mt-4 border-t pt-6 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                  <Activity className="h-5 w-5 text-neutral-500" />
                  Agent Tools
                  <Badge variant="outline" className="ml-2 border-neutral-200 text-xs">Internal Only</Badge>
                </h2>
                {isListingOwner && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-sm text-neutral-700">
                      <span className="flex items-center gap-1">
                        <Eye className="h-4 w-4 text-neutral-500" />
                        <strong className="text-neutral-900">{stats.views}</strong> Views
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-neutral-500" />
                        <strong className="text-neutral-900">{stats.matches}</strong> Matches
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      className="cursor-not-allowed border-neutral-200 px-3 opacity-50 shadow-none"
                      title="Coming soon in Communications Center"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Message All Matches
                    </Button>
                  </div>
                )}
            </div>

            {/* Agent-only: Showing + disclosures (two-column) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {/* LEFT COLUMN (Blue): Showing Instructions */}
                <Card className={cn(detailSurface, "h-full")}>
                  <CardHeader className="px-4 pb-2 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <KeyRound className="h-4 w-4 text-neutral-600" />
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
                    <div className="pt-3 border-t">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Instructions:</p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{listing.showing_instructions || "N/A"}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* RIGHT COLUMN: Disclosures, Exclusions & Listing Agreement */}
                <Card className={cn(detailSurface, "h-full")}>
                  <CardHeader className="px-4 pb-2 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <FileText className="h-4 w-4 text-neutral-600" />
                      {listingAgreementDisclosuresTitle(listing.listing_type)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3 text-sm">
                    {/* Structured disclosure fields - parsed & deduplicated */}
                    {(() => {
                      const parsed = parseDisclosures(listing.disclosures);
                      const nonEmpty = parsed.filter(f => !isEmptyValue(f.value));
                      if (nonEmpty.length === 0 && !listing.listing_exclusions && 
                          !(listing.listing_agreement_types && formatArray(listing.listing_agreement_types))) {
                        return <p className="text-muted-foreground">No disclosures on file</p>;
                      }
                      return (
                        <div className="space-y-2">
                          {nonEmpty.map((field, idx) => (
                            <div key={idx} className="flex justify-between py-1.5 border-b last:border-0">
                              <span className="text-muted-foreground">{field.label}</span>
                              <span className="font-medium text-right">{field.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {listing.listing_exclusions && !isEmptyValue(listing.listing_exclusions) && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Exclusions:</p>
                        <p>{listing.listing_exclusions}</p>
                      </div>
                    )}
                    {listing.listing_agreement_types && formatArray(listing.listing_agreement_types) && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          {listingAgreementSectionTitle(listing.listing_type)}:
                        </p>
                        <p className="font-medium">{formatArray(listing.listing_agreement_types)}</p>
                      </div>
                    )}
                    {listing.documents && Array.isArray(listing.documents) && listing.documents.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Documents:</p>
                        <p className="font-medium text-neutral-800">{listing.documents.length} document(s) available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {(() => {
                const cleaned = cleanBrokerComments(listing.broker_comments);
                if (!cleaned) return null;
                return (
                  <Card className={cn(detailSurface, "mt-4")}>
                    <CardHeader className="px-4 pb-2 pt-4">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                        <FileText className="h-4 w-4 text-neutral-600" />
                        Firm Remarks
                        <Badge variant="outline" className="ml-1 border-neutral-200 text-xs">
                          Agent Only
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{cleaned}</p>
                    </CardContent>
                  </Card>
                );
              })()}

                </div>
              )}

            </div>

            {/* Right rail — row 2; fixed pin tracks in-flow anchor on lg+ */}
            <div
              ref={anchorRef}
              className="order-4 min-w-0 w-full lg:col-start-2 lg:row-start-2 lg:self-start"
            >
              <div ref={panelRef} className={propertyRailStack} style={panelStyle}>
              {!isAgentView && (
                <Card className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <CardContent className="space-y-2.5 p-4">
                    <h3 className="text-sm font-semibold text-neutral-900">Take the next step</h3>

                    <Button
                      size="sm"
                      className={cn(
                        "h-9 w-full text-[13px] font-medium shadow-none",
                        listingDetailPrimaryCtaClass,
                      )}
                      onClick={() => setContactDialogOpen(true)}
                    >
                      Contact Agent
                    </Button>

                    <ScheduleShowingDialog
                      listingId={listing.id}
                      listingAddress={formatListingEmailSubjectLocation(listing)}
                      triggerLabel="Request a Showing"
                      triggerVariant="outline"
                      triggerClassName="h-10 w-full rounded-lg border-neutral-200 text-[13px] font-medium shadow-none hover:bg-neutral-50"
                    />

                    <FavoriteButton
                      listingId={listing.id}
                      size="sm"
                      variant="outline"
                      className="h-9 w-full rounded-lg border-neutral-200 text-[13px] font-medium shadow-none hover:bg-neutral-50"
                      labels={{
                        signIn: "Sign In to Save Home",
                        default: "Save Home",
                        saved: "Saved Home",
                      }}
                    />

                    <ContactAgentDialog
                      listingId={listing.id}
                      agentId={listing.agent_id}
                      listingAddress={formatListingEmailSubjectLocation(listing)}
                      open={contactDialogOpen}
                      onOpenChange={setContactDialogOpen}
                      hideTrigger
                    />
                  </CardContent>
                </Card>
              )}

              {(agentProfile || listing?.agent_id) && (
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
                        <p className="mt-1 text-lg font-bold leading-tight text-neutral-900">
                          {agentProfile
                            ? `${agentProfile.first_name} ${agentProfile.last_name}`
                            : "Listing Agent"}
                        </p>
                        {agentProfile && (
                          <div className={cn(propertyDetailAgentTitleBlock, "mt-0.5")}>
                            <p className="text-sm text-neutral-600">
                              {agentProfile.title || "Realtor"}
                            </p>
                            {agentProfile.company && (
                              <p className="text-sm text-muted-foreground">
                                {agentProfile.company}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={propertyDetailAgentContactRows}>
                      {agentProfile?.cell_phone && (
                        <a
                          href={`tel:${agentProfile.cell_phone}`}
                          className="flex items-center gap-2.5 transition-colors hover:text-neutral-900"
                        >
                          <Phone className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.cell_phone)}</span>
                        </a>
                      )}
                      {agentProfile?.phone && agentProfile.phone !== agentProfile.cell_phone && (
                        <a
                          href={`tel:${agentProfile.phone}`}
                          className="flex items-center gap-2.5 transition-colors hover:text-neutral-900"
                        >
                          <Building2 className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.phone)}</span>
                        </a>
                      )}
                      {isAgentView && agentProfile && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/agent/${agentProfile.id}`, {
                              state: {
                                from: location.pathname + location.search,
                                fromState: location.state,
                              },
                            })
                          }
                          className="flex w-full items-center gap-2.5 text-left transition-colors hover:text-neutral-900"
                        >
                          <ExternalLink className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">Profile</span>
                        </button>
                      )}
                      {isAgentView && canMessageListingAgent && (
                        <button
                          type="button"
                          onClick={openListingMessage}
                          className="flex w-full items-center gap-2.5 text-left transition-colors hover:text-neutral-900"
                        >
                          <MessageSquare className="h-4 w-4 shrink-0 text-[#0E56F5]" />
                          <span className="font-medium">Instant Message</span>
                        </button>
                      )}
                      {!isAgentView && agentProfile?.email && (
                          <a
                            href={`mailto:${agentProfile.email}`}
                            className="flex items-center gap-2.5 transition-colors hover:text-neutral-900"
                          >
                            <Mail className="h-4 w-4 shrink-0 text-neutral-500" />
                            <span className="font-medium truncate">{agentProfile.email}</span>
                          </a>
                      )}
                      {!isAgentView && agentProfile?.social_links?.website && (
                        <a
                          href={agentProfile.social_links.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 text-neutral-700 underline-offset-2 hover:text-neutral-900 hover:underline"
                        >
                          <Globe className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">Website</span>
                        </a>
                      )}
                    </div>

                    {!isAgentView && (
                      <ContactAgentDialog
                        listingId={listing.id}
                        agentId={listing.agent_id}
                        listingAddress={formatListingEmailSubjectLocation(listing)}
                      />
                    )}

                    {isAgentView && agentProfile?.email && (
                      <Button
                        className={cn(propertyDetailMessageCtaBase, propertyDetailMessageCta)}
                        onClick={() => setContactDialogOpen(true)}
                      >
                        <Mail />
                        Email Agent
                      </Button>
                    )}

                    {!isAgentView && canMessageListingAgent && (
                      <Button
                        className={cn(propertyDetailMessageCtaBase, propertyDetailMessageCta)}
                        onClick={openListingMessage}
                      >
                        <MessageSquare />
                        Message Agent
                      </Button>
                    )}

                    {isAgentView && (
                      <ContactAgentDialog
                        listingId={listing.id}
                        agentId={listing.agent_id}
                        listingAddress={formatListingEmailSubjectLocation(listing)}
                        open={contactDialogOpen}
                        onOpenChange={setContactDialogOpen}
                        hideTrigger
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {isAgentView && (
                <Card className={cn(consumerSectionCard, "mt-1 shadow-sm")}>
                  <CardContent className="space-y-2.5 p-4 pt-5">
                    <h3 className="text-sm font-semibold text-neutral-900">Listing inquiry</h3>

                    <ScheduleShowingDialog
                      listingId={listing.id}
                      listingAddress={formatListingEmailSubjectLocation(listing)}
                      triggerLabel="Request a Showing"
                      triggerVariant="outline"
                      triggerClassName={cn(
                        propertyDetailScheduleCtaBase,
                        propertyDetailScheduleCta,
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {buyerCompensationCard}

              {isAgentView && (
                <Card className={cn(consumerSectionCard, "shadow-sm")}>
                  <CardContent className="space-y-1.5 px-3 py-3">
                    {isListingOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/agent/listings/edit/${id}`, { state: { from: location.pathname + location.search } })}
                        className={cn(
                          "h-8 w-full justify-start gap-2 rounded-lg text-[13px] shadow-none",
                          listingDetailOutlineCtaClass,
                        )}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit Listing
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const el = document.getElementById("agent-tools-section");
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className={cn(
                        "h-8 w-full justify-start gap-2 rounded-lg text-[13px] shadow-none",
                        listingDetailOutlineCtaClass,
                      )}
                    >
                      <Activity className="h-3.5 w-3.5" />
                      View Agent Tools
                    </Button>
                  </CardContent>
                </Card>
              )}
              </div>
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

      {listing?.id && listingAgentId && (
        <ListingMessageDialog
          open={listingMessageOpen}
          onOpenChange={setListingMessageOpen}
          listingId={listing.id}
          variant="agent"
          recipient={
            agentProfile
              ? listingMessageRecipientFromProfile(agentProfile)
              : { id: listingAgentId, name: "Listing Agent", headshotUrl: null }
          }
          role={role}
          returnState={buildMessageReturnState(location.pathname, location.search)}
        />
      )}
    </div>
  );
};

export default PropertyDetail;
