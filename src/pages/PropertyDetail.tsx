import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, useNavigationType } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// Navigation removed - rendered globally in App.tsx
import { LoadingScreen } from "@/components/LoadingScreen";
import { AacBackButton } from "@/components/layout/AacBackLink";
import AACMonogram from "@/components/ui/AACMonogram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { getStatusConfig } from "@/constants/status";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
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
  Images,
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
  HelpCircle,
  MessageSquare,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { buildDisplayAddress, cn } from "@/lib/utils";
import { useListingView } from "@/hooks/useListingView";
import { useAuthRole } from "@/hooks/useAuthRole";
import { PropertyMetaTags } from "@/components/PropertyMetaTags";
import { Seo } from "@/components/Seo";
import { getPublicOrigin } from "@/lib/getPublicUrl";
import { ListingDetailSections } from "@/components/ListingDetailSections";
import { BuyerAgentShowcase } from "@/components/BuyerAgentShowcase";
import { BuyerCompensationInfoModal } from "@/components/BuyerCompensationInfoModal";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import PhotoGalleryDialog from "@/components/PhotoGalleryDialog";
import SocialShareMenu from "@/components/SocialShareMenu";
import ScheduleShowingDialog from "@/components/ScheduleShowingDialog";
import FavoriteButton from "@/components/FavoriteButton";
import PropertyMap from "@/components/PropertyMap";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";
import { parseDisclosures, cleanBrokerComments, isEmptyValue } from "@/lib/listingFieldParsers";
import { findOrCreateConversation } from "@/lib/startConversation";
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

interface SimilarListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: any[] | null;
  status: string;
}

interface AttomEnrichment {
  attomId: string | null;
  propertyType: string | null;
  stories: number | null;
  yearBuilt: number | null;
  lotSizeSqft: number | null;
  taxAmount: number | null;
  neighborhood: string | null;
  saleHistory: Array<{ date: string | null; amount: number | null; type: string | null }>;
  ownerOccupied: boolean | null;
  lastSaleAmount: number | null;
  lastSaleDate: string | null;
  zoning: string | null;
}

const mapLegacyAttomData = (raw: any): AttomEnrichment | null => {
  if (!raw || typeof raw !== "object") return null;

  return {
    attomId: raw.attom_id ? String(raw.attom_id) : raw.attomId ? String(raw.attomId) : null,
    propertyType: raw.property_type ?? raw.propertyType ?? null,
    stories: typeof raw.stories === "number" ? raw.stories : null,
    yearBuilt:
      typeof raw.year_built === "number"
        ? raw.year_built
        : typeof raw.yearBuilt === "number"
        ? raw.yearBuilt
        : null,
    lotSizeSqft:
      typeof raw.lot_size_sqft === "number"
        ? raw.lot_size_sqft
        : typeof raw.lotSizeSqft === "number"
        ? raw.lotSizeSqft
        : null,
    taxAmount:
      typeof raw.tax_amount === "number"
        ? raw.tax_amount
        : typeof raw.taxAmount === "number"
        ? raw.taxAmount
        : null,
    neighborhood: raw.neighborhood ?? raw.location_context ?? null,
    saleHistory: Array.isArray(raw.sale_history)
      ? raw.sale_history
      : Array.isArray(raw.saleHistory)
      ? raw.saleHistory
      : [],
    ownerOccupied:
      typeof raw.owner_occupied === "boolean"
        ? raw.owner_occupied
        : typeof raw.ownerOccupied === "boolean"
        ? raw.ownerOccupied
        : null,
    lastSaleAmount:
      typeof raw.last_sale_amount === "number"
        ? raw.last_sale_amount
        : typeof raw.lastSaleAmount === "number"
        ? raw.lastSaleAmount
        : null,
    lastSaleDate: raw.last_sale_date ?? raw.lastSaleDate ?? null,
    zoning: raw.zoning ?? null,
  };
};

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [stats, setStats] = useState({ matches: 0, views: 0 });
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'photos' | 'video' | 'tour' | 'website'>('photos');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [attomData, setAttomData] = useState<AttomEnrichment | null>(null);
  const [attomLoading, setAttomLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState<ListingPriceHistoryItem[]>([]);
  const [similarHomes, setSimilarHomes] = useState<SimilarListing[]>([]);
  
  // Role detection + URL-based client mode
  const { user, role, loading: roleLoading } = useAuthRole();
  const isAgent = role === "agent";
  const isAdmin = role === "admin";
  const isBuyer = role === "buyer";

  // Redirect buyers to the buyer-safe detail page (keep query + route state, e.g. Favorites back link)
  useEffect(() => {
    if (!roleLoading && isBuyer && id) {
      const q = location.search;
      navigate(`/consumer-property/${id}${q}`, { replace: true, state: location.state });
    }
  }, [roleLoading, isBuyer, id, navigate, location]);
  
  // Check for client mode via URL query param or path suffix
  const searchParams = new URLSearchParams(location.search);
  const isClientMode = searchParams.get('view') === 'client' || location.pathname.endsWith('/client');
  const isAgentView = (isAgent || isAdmin) && !isClientMode;

  // ATTRIBUTION MASKING: PropertyDetail is agent/admin-only UI.
  // Non-agent visitors must not see any "contact listing agent" UI, even briefly.
  // Buyers redirect to /consumer-property/:id (effect above).
  const isNonAgentVisitor = !roleLoading && !isAgent && !isAdmin;

  // Can current user message the listing agent?
  const viewerId = user?.id;
  const listingAgentId = agentProfile?.id;
  const canMessageListingAgent =
    !!viewerId &&
    (role === "agent" || role === "admin") &&
    !!listingAgentId &&
    viewerId !== listingAgentId;

  /** In-app return path only (blocks protocol-relative `//`). */
  const isSafeInternalReturnPath = (path: string) =>
    path.startsWith("/") && !path.startsWith("//");

  /**
   * `/property/:id` is shared; back must never send agents to buyer routes by default.
   * Prefer explicit `location.state.from`, then history when stacked via PUSH, else role fallback.
   */
  const handlePropertyDetailBack = () => {
    const params = new URLSearchParams(location.search);
    const st = (location.state as { from?: string } | null)?.from;

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
    if ((isAgent || isAdmin) && navigationType === "PUSH") {
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

  const handleMessageListingAgent = async () => {
    if (!viewerId || !listingAgentId || isStartingChat) return;
    
    setIsStartingChat(true);
    try {
      const convoId = await findOrCreateConversation(viewerId, listingAgentId, {
        listingId: listing?.id ?? null,
      });
      if (convoId) {
        navigate(`/messages/${convoId}`);
      } else {
        toast.error("Couldn't start message. Please try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't start message. Please try again.");
    } finally {
      setIsStartingChat(false);
    }
  };

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

  useEffect(() => {
    if (!listing) return;

    const fallback = mapLegacyAttomData((listing as any).attom_data);
    setAttomData(fallback);

    let cancelled = false;

    const enrichFromAttom = async () => {
      setAttomLoading(true);
      try {
        const response = await fetch("/api/attom-property-enrichment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attomId: (listing as any).attom_id ?? null,
            address: listing.address,
            city: listing.city,
            state: listing.state,
            zip: listing.zip_code,
          }),
        });

        const payload = await response.json().catch(() => null);
        if (cancelled || !payload?.success) return;

        if (payload?.data) {
          setAttomData(payload.data as AttomEnrichment);
        }
      } catch (error) {
        // Keep fallback data and avoid noisy UX for optional enrichment.
        console.warn("[PropertyDetail] ATTOM enrichment unavailable, using fallback data");
      } finally {
        if (!cancelled) {
          setAttomLoading(false);
        }
      }
    };

    void enrichFromAttom();

    return () => {
      cancelled = true;
    };
  }, [listing]);

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

  useEffect(() => {
    if (!listing?.id || !listing?.city || !listing?.state) return;

    let cancelled = false;

    const fetchSimilarHomes = async () => {
      const baseQuery = supabase
        .from("listings")
        .select("id, address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, photos, status")
        .eq("city", listing.city)
        .eq("state", listing.state)
        .neq("id", listing.id)
        .in("status", ["active", "coming_soon"])
        .order("created_at", { ascending: false });

      const minPrice = Math.max(0, Math.floor((listing.price || 0) * 0.8));
      const maxPrice = Math.ceil((listing.price || 0) * 1.2);

      const { data: inRange } = await baseQuery
        .gte("price", minPrice)
        .lte("price", maxPrice)
        .limit(3);

      let results = (inRange || []) as SimilarListing[];

      if (results.length === 0) {
        const { data: fallback } = await supabase
          .from("listings")
          .select("id, address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, photos, status")
          .eq("city", listing.city)
          .eq("state", listing.state)
          .neq("id", listing.id)
          .in("status", ["active", "coming_soon"])
          .order("created_at", { ascending: false })
          .limit(3);
        results = (fallback || []) as SimilarListing[];
      }

      if (!cancelled) {
        setSimilarHomes(results);
      }
    };

    void fetchSimilarHomes();

    return () => {
      cancelled = true;
    };
  }, [listing?.id, listing?.city, listing?.state, listing?.price]);

  // ATTRIBUTION MASKING early return — after all hooks, before any JSX
  if (isNonAgentVisitor) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

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
      <div className="min-h-screen bg-white pt-16 sm:pt-20">
        <div className="mx-auto max-w-lg px-4 py-10">
          <Card className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CardContent className="space-y-4 py-10">
              <p className="text-center text-[15px] text-neutral-600">Listing not found</p>
              <div className="flex justify-center">
                <Button variant="outline" className="border-neutral-200" onClick={() => navigate("/")}>
                  Back to Home
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
  const agentLogo = agentProfile?.logo_url || DEFAULT_BROKERAGE_LOGO_URL;

  /** Premium neutral section shell (matches listing search results). */
  const detailSurface =
    "rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]";
  const detailTitle =
    "flex items-center gap-2 text-base font-semibold tracking-tight text-neutral-900";
  const detailTitleIcon = "h-5 w-5 shrink-0 text-neutral-600";

  return (
    <div className="min-h-screen bg-white pt-0">
      <Seo
        title={`${listing.address}, ${listing.city}, ${listing.state}`}
        description={
          listing.description
            ? `$${listing.price.toLocaleString()} — ${listing.bedrooms} bed, ${listing.bathrooms} bath. ${listing.description.substring(0, 120)}…`
            : `$${listing.price.toLocaleString()} — ${listing.bedrooms} bed, ${listing.bathrooms} bath in ${listing.city}, ${listing.state}`
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
            price: listing.price,
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


      <main className="flex-1">
        {/* Slim brand strip — neutral (listing detail premium shell) */}
        <div className="w-full border-b border-neutral-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-2.5 sm:py-3">
            <div className="flex items-center gap-2">
              <AACMonogram className="h-6 w-6 text-neutral-700 sm:h-7 sm:w-7" />
              <span
                className="text-[14px] font-semibold tracking-tight text-neutral-900 sm:text-[15px]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Direct Connect MLS
              </span>
            </div>
          </div>
        </div>

        {/* Back Button Row */}
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-3">
          {(() => {
            const params = new URLSearchParams(location.search);
            const stateFrom = (location.state as { from?: string } | null)?.from;
            const fromFavorites =
              params.get("from") === "favorites" ||
              stateFrom === "/client/favorites" ||
              stateFrom === "/favorites";
            const label = fromFavorites
              ? "Back to Favorites"
              : stateFrom === "/client/search"
                ? "Back to Results"
                : stateFrom?.startsWith("/listing-results")
                  ? "Back to Results"
                  : typeof stateFrom === "string" && isSafeInternalReturnPath(stateFrom)
                    ? "Back"
                    : isAgent || isAdmin
                      ? "Back"
                      : isBuyer
                        ? "Back to Dashboard"
                        : "Back to Browse";
            return (
          <AacBackButton
            type="button"
            onClick={handlePropertyDetailBack}
            className="text-[13px]"
            aria-label={fromFavorites ? "Back to Favorites" : "Go back"}
          >
            {label}
          </AacBackButton>
            );
          })()}
        </div>

        {/* ========== LISTING HEADER — Address + Price above hero, constrained to media column width ========== */}
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <div className="lg:w-[68%] pr-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h1 className="flex items-baseline gap-1.5 text-lg font-semibold tracking-tight text-neutral-900">
                <MapPin className="relative top-px h-4 w-4 shrink-0 text-neutral-500" />
                {buildDisplayAddress(listing as any)}
              </h1>
              <div className="text-right">
                <p className="text-lg font-bold tracking-tight text-neutral-900">
                  ${listing?.price?.toLocaleString() ?? "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== HERO SECTION: TWO-COLUMN GRID ========== */}
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* LEFT COLUMN - Floating Photo Carousel (~68%) */}
            <div className="lg:w-[68%]">
              <div className="relative pb-6">
                <div className="relative h-[380px] overflow-hidden rounded-xl border border-neutral-200 shadow-[0_4px_24px_rgba(0,0,0,0.07)] sm:h-[480px] sm:rounded-2xl lg:h-[560px]">
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
                      {isAgentView && listing.listing_number && (
                        <Badge variant="outline" className="font-mono text-xs bg-white/90 backdrop-blur-sm">
                          #{listing.listing_number}
                        </Badge>
                      )}
                      <Badge className={`${getStatusColor(listing.status)} bg-white/90 backdrop-blur-sm`}>
                        {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                      </Badge>
                    </div>

                    {/* Heart Control - Top Right Overlay */}
                    <div
                      className="absolute top-3 right-3 z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FavoriteButton listingId={listing.id} size="icon" photoIcon />
                    </div>
                    
                    {/* Carousel Arrow Controls - Only for Photos */}
                    {activeMediaTab === 'photos' && listing.photos && listing.photos.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevPhoto}
                          className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-[2px] transition-colors hover:bg-black/65 sm:left-4 sm:h-11 sm:w-11"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                        </button>
                        <button
                          onClick={handleNextPhoto}
                          className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-[2px] transition-colors hover:bg-black/65 sm:right-4 sm:h-11 sm:w-11"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
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
                        className="absolute bottom-[4.75rem] right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-[2px] transition-colors hover:bg-black/65 sm:bottom-[5rem] sm:right-4 sm:h-10 sm:w-10"
                        aria-label="Expand gallery"
                      >
                        <Expand className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-1 right-4 z-30">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-[2px] transition-colors hover:bg-black/65 sm:h-11 sm:w-11"
                        aria-label="Share property"
                      >
                        <Share2 className="h-5 w-5 sm:h-5 sm:w-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 border-neutral-200 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
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
              </div>

              {/* Media Type Tabs - Below Photo with more spacing to clear shadow */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 sm:mt-6">
                <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant={activeMediaTab === 'photos' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleMediaTabChange('photos')}
                  className={cn(
                    "h-8 rounded-lg px-3 text-[13px] font-medium shadow-none",
                    activeMediaTab === 'photos'
                      ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white"
                      : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50",
                  )}
                >
                  <Images className="mr-1.5 h-3.5 w-3.5" />
                  Photos
                </Button>
                {listing.video_url && (
                  <Button
                    variant={activeMediaTab === 'video' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleMediaTabChange('video')}
                    className={cn(
                      "h-8 rounded-lg px-3 text-[13px] font-medium shadow-none",
                      activeMediaTab === 'video'
                        ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white"
                        : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50",
                    )}
                  >
                    <Video className="mr-1.5 h-3.5 w-3.5" />
                    Video
                  </Button>
                )}
                {listing.virtual_tour_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(listing.virtual_tour_url!, '_blank', 'noopener,noreferrer')}
                    className="h-8 rounded-lg border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-none hover:bg-neutral-50"
                  >
                    <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
                    3D Tour
                  </Button>
                )}
                {listing.property_website_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(listing.property_website_url!, '_blank', 'noopener,noreferrer')}
                    className="h-8 rounded-lg border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-none hover:bg-neutral-50"
                  >
                    <Globe className="mr-1.5 h-3.5 w-3.5" />
                    Website
                  </Button>
                )}
                </div>
                
              </div>

              {/* ========== STATS ROW ========== */}
              <div className="mt-4">
                {/* Stats - first content block below media */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-neutral-100 pb-2">
                  {listing.bedrooms && (
                    <div className="flex items-center gap-1">
                      <Bed className="h-4 w-4 text-neutral-500" />
                      <span className="font-semibold text-neutral-900">{listing.bedrooms}</span>
                      <span className="text-xs text-neutral-600">Beds</span>
                    </div>
                  )}
                  {listing.bathrooms && (
                    <div className="flex items-center gap-1">
                      <Bath className="h-4 w-4 text-neutral-500" />
                      <span className="font-semibold text-neutral-900">{listing.bathrooms}</span>
                      <span className="text-xs text-neutral-600">Baths</span>
                    </div>
                  )}
                  {listing.square_feet && (
                    <div className="flex items-center gap-1">
                      <Square className="h-4 w-4 text-neutral-500" />
                      <span className="font-semibold text-neutral-900">{listing.square_feet.toLocaleString()}</span>
                      <span className="text-xs text-neutral-600">Sq Ft</span>
                    </div>
                  )}
                  {listing?.square_feet && listing.square_feet > 0 && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-neutral-500" />
                      <span className="font-semibold text-neutral-900">
                        ${Math.round(listing.price / listing.square_feet).toLocaleString()}
                      </span>
                      <span className="text-xs text-neutral-600">/sf</span>
                    </div>
                  )}
                </div>
              </div>

            </div>


            {/* RIGHT COLUMN - Hero Sidebar (~32%) - Clean, no internal scrolling */}
            <div className="lg:w-[32%] space-y-3 lg:sticky lg:top-24 lg:self-start">

              {/* Primary Consumer CTAs */}
              <Card className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <CardContent className="space-y-2.5 p-4">
                  <h3 className="text-sm font-semibold text-neutral-900">Take the next step</h3>

                  <Button
                    size="sm"
                    className="h-9 w-full bg-neutral-900 text-[13px] font-medium text-white hover:bg-neutral-800"
                    onClick={() => setContactDialogOpen(true)}
                  >
                    Contact Agent
                  </Button>

                  <ScheduleShowingDialog
                    listingId={listing.id}
                    listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
                    triggerLabel="Request a Showing"
                    triggerVariant="outline"
                    triggerClassName="h-9 w-full rounded-lg border-neutral-200 text-[13px] font-medium shadow-none hover:bg-neutral-50"
                  />

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-full rounded-lg border-neutral-200 text-[13px] font-medium shadow-none hover:bg-neutral-50"
                    onClick={() => setContactDialogOpen(true)}
                  >
                    Ask a Question
                  </Button>

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
                    listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
                    open={contactDialogOpen}
                    onOpenChange={setContactDialogOpen}
                    hideTrigger
                  />
                </CardContent>
              </Card>
              
              {/* Listing Agent Card - PRIMARY (top) */}
              {agentProfile && (
                <Card className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center gap-4">
                      <AgentAvatar
                        name={`${agentProfile.first_name} ${agentProfile.last_name}`}
                        headshotUrl={agentProfile.headshot_url ?? null}
                        userId={agentProfile.id}
                        size="xl"
                        avatarClassName="h-16 w-16 border border-neutral-200"
                        fallbackClassName="bg-neutral-800 text-white"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Listing Agent</p>
                        <p className="text-lg font-bold leading-tight text-neutral-900">
                          {agentProfile.first_name} {agentProfile.last_name}
                        </p>
                        <p className="text-sm text-neutral-600">
                          {agentProfile.title || 'Realtor'} · {agentProfile.company || "Brokerage"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      {agentProfile.cell_phone && (
                        <a
                          href={`tel:${agentProfile.cell_phone}`}
                          className="flex items-center gap-2.5 transition-colors hover:text-neutral-900"
                        >
                          <Phone className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.cell_phone)}</span>
                          <span className="ml-auto text-xs text-neutral-500">Mobile</span>
                        </a>
                      )}
                      {agentProfile.phone && agentProfile.phone !== agentProfile.cell_phone && (
                        <a
                          href={`tel:${agentProfile.phone}`}
                          className="flex items-center gap-2.5 transition-colors hover:text-neutral-900"
                        >
                          <Building2 className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium">{formatPhoneNumber(agentProfile.phone)}</span>
                          <span className="ml-auto text-xs text-neutral-500">Office</span>
                        </a>
                      )}
                      {agentProfile.email && (
                        <a
                          href={`mailto:${agentProfile.email}`}
                          className="flex items-center gap-2.5 transition-colors hover:text-neutral-900"
                        >
                          <Mail className="h-4 w-4 shrink-0 text-neutral-500" />
                          <span className="font-medium truncate">{agentProfile.email}</span>
                        </a>
                      )}
                      {agentProfile.social_links?.website && (
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

                    <ContactAgentDialog
                      listingId={listing.id}
                      agentId={listing.agent_id}
                      listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
                    />
                    
                    {/* Message about this listing button - agents/admins only */}
                    {canMessageListingAgent && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-9 w-full gap-2 rounded-lg border-neutral-200 text-[13px] font-medium shadow-none hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-60"
                        onClick={handleMessageListingAgent}
                        disabled={isStartingChat}
                        aria-busy={isStartingChat}
                      >
                        <MessageSquare className="w-4 h-4" />
                        {isStartingChat 
                          ? "Opening…" 
                          : listing?.id 
                            ? "Message about this listing" 
                            : "Message"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Brokerage Strip - SECONDARY (below agent) */}
              <Card className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
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
                      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Listing courtesy of</p>
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {agentProfile?.company || "Brokerage"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ========== AGENT QUICK ACTIONS (stays in sidebar) ========== */}
              {isAgentView && (
                <Card className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <CardContent className="space-y-1.5 px-3 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/agent/listings/edit/${id}`, { state: { from: location.pathname + location.search } })}
                      className="h-8 w-full justify-start gap-2 rounded-lg border-neutral-200 text-[13px] shadow-none hover:bg-neutral-50"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit Listing
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviewClientView}
                      className="h-8 w-full justify-start gap-2 rounded-lg border-neutral-200 text-[13px] shadow-none hover:bg-neutral-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview Client View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const el = document.getElementById('agent-tools-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="h-8 w-full justify-start gap-2 rounded-lg border-neutral-200 text-[13px] shadow-none hover:bg-neutral-50"
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
                  <Card className={detailSurface}>
                    <CardHeader className="pb-2">
                      <CardTitle className={detailTitle}>
                        <FileText className={detailTitleIcon} />
                        About this home
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm leading-relaxed text-neutral-800">
                      <p className="whitespace-pre-wrap">{visibleText}</p>
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => setDescriptionExpanded(v => !v)}
                          className="text-sm font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-0"
                        >
                          {descriptionExpanded ? 'Read less' : 'Read more'}
                        </button>
                      )}
                      
                      {/* Agent-Only: Broker Remarks (cleaned & deduplicated) */}
                      {isAgentView && (() => {
                        const cleaned = cleanBrokerComments(listing.broker_comments);
                        if (!cleaned) return null;
                        return (
                          <div className="mt-4 rounded-lg border border-amber-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                                Broker Remarks
                              </span>
                              <Badge variant="outline" className="border-neutral-200 text-xs">Agent Only</Badge>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-neutral-700">
                              {cleaned}
                            </p>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* MLS-Style Detail Sections */}
              <ListingDetailSections 
                listing={listing} 
                agent={agentProfile}
                isAgentView={isAgentView}
                premiumNeutralSurfaces
              />

              {/* Public Record Insights (server-side ATTOM enrichment with graceful fallback) */}
              <Card className={detailSurface}>
                <CardHeader className="pb-2">
                  <CardTitle className={detailTitle}>
                    <Info className={detailTitleIcon} />
                    Public Record Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attomLoading && !attomData ? (
                    <p className="text-sm text-muted-foreground">Loading public record details...</p>
                  ) : attomData ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {attomData.propertyType && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Property Type</span>
                          <span className="font-semibold text-right">{attomData.propertyType}</span>
                        </div>
                      )}
                      {typeof attomData.stories === "number" && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Stories</span>
                          <span className="font-semibold text-right">{attomData.stories}</span>
                        </div>
                      )}
                      {typeof attomData.yearBuilt === "number" && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Year Built</span>
                          <span className="font-semibold text-right">{attomData.yearBuilt}</span>
                        </div>
                      )}
                      {typeof attomData.lotSizeSqft === "number" && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Lot Size</span>
                          <span className="font-semibold text-right">{attomData.lotSizeSqft.toLocaleString()} sqft</span>
                        </div>
                      )}
                      {typeof attomData.lastSaleAmount === "number" && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Last Sale</span>
                          <span className="font-semibold text-right">${attomData.lastSaleAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {attomData.lastSaleDate && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Last Sale Date</span>
                          <span className="font-semibold text-right">{new Date(attomData.lastSaleDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {typeof attomData.taxAmount === "number" && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Annual Tax</span>
                          <span className="font-semibold text-right">${attomData.taxAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {attomData.neighborhood && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Neighborhood</span>
                          <span className="font-semibold text-right">{attomData.neighborhood}</span>
                        </div>
                      )}
                      {attomData.zoning && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Zoning</span>
                          <span className="font-semibold text-right">{attomData.zoning}</span>
                        </div>
                      )}
                      {typeof attomData.ownerOccupied === "boolean" && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Owner Occupied</span>
                          <span className="font-semibold text-right">{attomData.ownerOccupied ? "Yes" : "No"}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Public record details are temporarily unavailable for this home.
                    </p>
                  )}

                  {attomData && Array.isArray(attomData.saleHistory) && attomData.saleHistory.length > 0 && (
                    <div className="mt-4 border-t border-neutral-100 pt-4">
                      <h4 className="text-sm font-semibold mb-2">Sale History</h4>
                      <div className="space-y-2">
                        {attomData.saleHistory.slice(0, 3).map((item, index) => (
                          <div key={`${item.date || "unknown"}-${index}`} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {item.date ? new Date(item.date).toLocaleDateString() : "Unknown date"}
                            </span>
                            <span className="font-semibold">
                              {typeof item.amount === "number" ? `$${item.amount.toLocaleString()}` : "Amount unavailable"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Price & Tax History */}
              {(priceHistory.length > 0 || typeof listing.annual_property_tax === "number" || typeof listing.tax_assessment_value === "number") && (
                <Card className={detailSurface}>
                  <CardHeader className="pb-2">
                    <CardTitle className={detailTitle}>
                      <Calendar className={detailTitleIcon} />
                      Price & Tax History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(typeof listing.annual_property_tax === "number" || typeof listing.tax_assessment_value === "number") && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pb-4 border-b">
                        {typeof listing.annual_property_tax === "number" && (
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Annual Property Tax</span>
                            <span className="font-semibold">${listing.annual_property_tax.toLocaleString()}</span>
                          </div>
                        )}
                        {typeof listing.tax_assessment_value === "number" && (
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Assessed Value</span>
                            <span className="font-semibold">${listing.tax_assessment_value.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {priceHistory.length > 0 && (
                      <div className="space-y-2">
                        {priceHistory.slice(0, 5).map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{new Date(entry.changed_at).toLocaleDateString()}</span>
                            <span className="font-semibold">${entry.new_price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Location / Neighborhood */}
              {(listing.latitude || listing.longitude || listing.neighborhood || (attomData && attomData.neighborhood) || listing.walk_score_data) && (
                <Card className={detailSurface}>
                  <CardHeader className="pb-2">
                    <CardTitle className={detailTitle}>
                      <MapPin className={detailTitleIcon} />
                      Location & Neighborhood
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(listing.neighborhood || attomData?.neighborhood) && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Neighborhood: </span>
                        <span className="font-semibold">{listing.neighborhood || attomData?.neighborhood}</span>
                      </div>
                    )}

                    {listing.walk_score_data && typeof listing.walk_score_data === "object" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {(listing.walk_score_data as any).walkscore && (
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Walk Score</span>
                            <span className="font-semibold">{(listing.walk_score_data as any).walkscore}</span>
                          </div>
                        )}
                        {(listing.walk_score_data as any).transit?.score && (
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Transit Score</span>
                            <span className="font-semibold">{(listing.walk_score_data as any).transit.score}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {(listing.latitude || listing.longitude) && (
                      <PropertyMap
                        address={`${listing.address}, ${listing.city}, ${listing.state} ${listing.zip_code}`}
                        latitude={listing.latitude}
                        longitude={listing.longitude}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Similar Homes */}
              {similarHomes.length > 0 && (
                <Card className={detailSurface}>
                  <CardHeader className="pb-2">
                    <CardTitle className={detailTitle}>
                      <Home className={detailTitleIcon} />
                      Similar homes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {similarHomes.map((home) => {
                        const firstPhoto = Array.isArray(home.photos)
                          ? typeof home.photos[0] === "string"
                            ? home.photos[0]
                            : home.photos[0]?.url
                          : null;

                        return (
                          <button
                            key={home.id}
                            type="button"
                            onClick={() => navigate(`/property/${home.id}`)}
                            className="overflow-hidden rounded-lg border border-neutral-200 bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color] hover:border-neutral-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
                          >
                            <div className="h-32 overflow-hidden bg-neutral-100">
                              {firstPhoto ? (
                                <img src={firstPhoto} alt={home.address} className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">No photo</div>
                              )}
                            </div>
                            <div className="space-y-1 p-3">
                              <p className="line-clamp-1 text-sm font-semibold text-neutral-900">${home.price.toLocaleString()}</p>
                              <p className="line-clamp-1 text-xs text-neutral-600">{home.address}</p>
                              <p className="text-xs text-neutral-600">
                                {home.bedrooms ?? "-"} bd • {home.bathrooms ?? "-"} ba • {home.square_feet ? `${home.square_feet.toLocaleString()} sqft` : "-"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* RIGHT COLUMN - Consumer-facing content (not in hero sidebar) */}
            <div className="space-y-6">
              {/* Buyer Agent Compensation - Client View Only (single line with info popup) */}
              {!isAgentView && compensationDisplay && (
                <Card className="rounded-xl border border-emerald-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <CardContent className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <DollarSign className="h-4 w-4 shrink-0 text-emerald-700" />
                      <span className="text-sm font-medium text-neutral-900">
                        Buyer Agent Compensation: {compensationDisplay} (paid by seller)
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="ml-auto rounded-md p-1 text-emerald-800 transition-colors hover:bg-emerald-50/80 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-0"
                          >
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md border-neutral-200">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-neutral-900">
                              <DollarSign className="h-5 w-5 text-emerald-700" />
                              Buyer Agent Compensation
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 py-4 text-sm text-neutral-600">
                            <p>
                              This compensation is <strong className="text-neutral-900">paid by the seller</strong> and 
                              offered to buyer agents who bring qualified buyers.
                            </p>
                            <p>
                              <strong className="text-neutral-900">Is this negotiable?</strong><br />
                              Yes, compensation terms may be negotiable. Discuss with the listing agent for details.
                            </p>
                            <p>
                              <strong className="text-neutral-900">Note:</strong> Actual compensation may vary based on 
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

              {/* ATTRIBUTION MASKING: No "Contact listing agent" fallback.
                  Buyers redirect to /consumer-property/:id; non-agents early-return above. */}
            </div>
          </div>
        </div>

        {/* ========== AGENT TOOLS SECTION (Agent-Only, NOT sticky) - 50/50 layout ========== */}
        {isAgentView && (
          <div id="agent-tools-section" className="mx-auto max-w-6xl px-4 pb-8">
            <div className="border-t pt-6 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                  <Activity className="h-5 w-5 text-neutral-500" />
                  Agent Tools
                  <Badge variant="outline" className="ml-2 border-neutral-200 text-xs">Internal Only</Badge>
                </h2>
                {/* Views & Matches grouped with Broadcast */}
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
            </div>

            {/* Buyer Agent Compensation - Green Box (moved up) */}
            {compensationDisplay && (
              <Card className="mt-4 rounded-xl border border-emerald-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <CardContent className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <DollarSign className="h-4 w-4 shrink-0 text-emerald-700" />
                    <span className="text-sm font-medium text-neutral-900">
                      Buyer Agent Compensation: {compensationDisplay} (paid by seller)
                    </span>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="ml-auto rounded-md p-1 text-emerald-800 transition-colors hover:bg-emerald-50/80 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-0"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md border-neutral-200">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-neutral-900">
                            <DollarSign className="h-5 w-5 text-emerald-700" />
                            Buyer Agent Compensation
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-4 text-sm text-neutral-600">
                          <p>
                            This compensation is <strong className="text-neutral-900">paid by the seller</strong> and 
                            offered to buyer agents who bring qualified buyers.
                          </p>
                          <p>
                            <strong className="text-neutral-900">Is this negotiable?</strong><br />
                            Yes, compensation terms may be negotiable. Discuss with the listing agent for details.
                          </p>
                          {listing.commission_notes && (
                            <p className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-neutral-800">
                              <strong className="text-neutral-900">Notes:</strong> {listing.commission_notes}
                            </p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}
            
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

                {/* RIGHT COLUMN (Yellow): Disclosures, Exclusions, Listing Agreement, Firm Remarks */}
                <Card className={cn(detailSurface, "h-full")}>
                  <CardHeader className="px-4 pb-2 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <FileText className="h-4 w-4 text-neutral-600" />
                      Disclosures, Exclusions & Listing Agreement
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
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Listing Agreement:</p>
                        <p className="font-medium">{formatArray(listing.listing_agreement_types)}</p>
                      </div>
                    )}
                    {listing.documents && Array.isArray(listing.documents) && listing.documents.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Documents:</p>
                        <p className="font-medium text-neutral-800">{listing.documents.length} document(s) available</p>
                      </div>
                    )}
                    {/* Firm Remarks - cleaned & deduplicated, agent only */}
                    {(() => {
                      const cleaned = cleanBrokerComments(listing.broker_comments);
                      if (!cleaned) return null;
                      return (
                        <div className="pt-2 border-t">
                          <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                            Firm Remarks
                            <Badge variant="outline" className="text-[10px] ml-1">Agent Only</Badge>
                          </p>
                          <p className="whitespace-pre-wrap leading-relaxed">{cleaned}</p>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

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
