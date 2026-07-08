import { useState, useEffect } from "react";
import { useListingBanners } from "@/hooks/useListingBanners";
import { Card, CardContent } from "@/components/ui/card";
import { ListingCardShell } from "@/components/ListingCardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { Bed, Bath, Home, Edit, Trash2, Eye, Calendar, Users, Mail, Heart, Star, BarChart3, Sparkles, TrendingDown, RefreshCw, Maximize, ChevronLeft, ChevronRight, Phone, User, MessageSquare, CircleParking } from "lucide-react";
import { ListingInterestSignals } from "./ListingInterestSignals";
import type { ListingSignals } from "@/hooks/useListingInterestSignals";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ReverseProspectDialog } from "./ReverseProspectDialog";
import MarketInsightsDialog from "./MarketInsightsDialog";
import ContactAgentDialog from "./ContactAgentDialog";
import FavoriteButton from "./FavoriteButton";
import { useAuthRole } from "@/hooks/useAuthRole";
import { ListingAttribution } from "./ListingAttribution";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn, propertyTypeToEnum } from "@/lib/utils";
import { ListingCardAddressLine } from "@/components/listing/ListingCardAddressLine";
import {
  listingSelectionCardCompactSelected,
  listingSelectionCardGridSelected,
  listingSelectionCheckboxClass,
} from "@/lib/listingSelectionStyles";
import {
  listingAgentContactFromRow,
  listingEmailSubjectFromRow,
  type ListingAgentContact,
} from "@/lib/listingAgentContact";
import { formatListingEmailSubjectLocation } from "@/lib/listingEmailSubject";
import { formatListingIdLabel, LISTING_ID_NAV_CLASS } from "@/lib/listingIdDisplay";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { LISTING_STATUS, isComingSoon, isActive } from "@/constants/status";
import {
  resolveBrokerageAttribution,
  resolveListedByAttribution,
  type ListedByAgentProfile,
  type ListedBySource,
} from "@/lib/listingListedBy";
import { ListingCardAttributionStrip } from "@/components/listing/ListingCardAttributionStrip";
import { ListingCardPropertyTypeLine } from "@/components/listing/ListingCardPropertyTypeLine";
import { formatListingPriceDisplay, listingEffectiveNumericPrice } from "@/lib/formatListingPriceDisplay";

/** Normalize MLS photos (array, JSON string, single URL string) for compact/grid photo helpers. */
function normalizeListingPhotos(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t) as unknown;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [t];
  }
  return [];
}

interface ListingCardProps {
  listing: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    price: number | null;
    property_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    square_feet: number | null;
    total_parking_spaces?: number | null;
    garage_spaces?: number | null;
    status: string;
    photos?: any;
    open_houses?: any;
    listing_type?: string | null;
    created_at?: string;
    active_date?: string | null;
    listing_number?: string | null;
    publish_to_dcmls?: boolean;
    is_relisting?: boolean;
    original_listing_id?: string | null;
    condo_details?: any;
    unit_number?: string | null;
    cancelled_at?: string | null;
    listing_stats?: {
      view_count: number;
      save_count: number;
      contact_count: number;
      showing_request_count: number;
      cumulative_active_days: number;
    };
    neighborhood?: string | null;
    agent_id?: string;
    price_range_min?: number | null;
    price_range_max?: number | null;
    /** MLS / feed listing agent or office (search results) */
    listing_agent_name?: string | null;
    agent_name?: string | null;
    agent_email?: string | null;
    brokerage_name?: string | null;
    listing_brokerage?: string | null;
    list_office?: string | null;
    agent_profile?: ListedByAgentProfile;
  };
  onReactivate?: (id: string) => void;
  onDelete?: (id: string) => void;
  viewMode?: 'grid' | 'list' | 'compact';
  showActions?: boolean;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  hideMlsMeta?: boolean;
  agentInfo?: {
    name: string;
    company?: string | null;
  } | null;
  clientComment?: string;
  chatMessages?: Array<{
    id: string;
    hot_sheet_id: string;
    listing_id: string;
    comment: string;
    sender_role: string;
    sender_id: string | null;
    created_at: string;
  }>;
  /**
   * Optional hot-sheet id for parents that mount `ListingChatDrawer` with `hot_sheet_comments` realtime.
   * Compact listing discussion opened via `onOpenChat` does **not** use this prop.
   */
  hotSheetId?: string;
  onNewMessage?: (msg: any) => void;
  /** Opens listing discussion (Sheet, inbox thread, or hot-sheet drawer). Never gated on `hotSheetId`. */
  onOpenChat?: () => void;
  interestSignals?: ListingSignals | null;
  /** Favorited on the current hot sheet (e.g. by client) */
  isHotSheetFavorite?: boolean;
  /** Listing row lacks `agent_profile` embed; pass batch-fetched profiles for “Listed by” */
  supplementalAgentProfile?: ListedByAgentProfile | null;
  /** Favorites: reserve listed-by row height so async profile hydrate does not jump layout */
  isFavorites?: boolean;
  /**
   * Favorites + hot-sheet listing grids: minimal comment row below stats / Listed by.
   * Map/search compact cards omit this prop so the bar stays hidden.
   */
  showCompactComments?: boolean;
  /**
   * Agent-owned compact grids (Success Hub «My listings»): first photo only, no favorite/shortlist overlay,
   * no carousel arrows, no NEW LISTING / promo banners — same typography/shell as buyer compact cards.
   */
  compactAgentOwned?: boolean;
  /** Neighborhood image pill on compact cards (e.g. agent profile); independent of `compactAgentOwned`. */
  compactShowNeighborhood?: boolean;
  /**
   * When set, compact `viewMode` navigations to listing detail include this router `state` (e.g. `{ from }` back link).
   * Omit everywhere else — default is plain `/property/:id`.
   */
  compactDetailNavigateState?: Record<string, unknown>;
  /**
   * When set, compact detail opens this path (e.g. buyer `/consumer-property/:id?returnTo=…`).
   * Omit for agent/public surfaces — default is `/property/:id`.
   */
  compactListingDetailTo?: string;
  /** Agent MLS search / workflow: hide consumer favorite heart on compact cards only. */
  hideCompactFavorite?: boolean;
  /** Omit FavoriteButton hover tooltip (e.g. hot sheet matches — toast only). */
  hideFavoriteTooltip?: boolean;
  /** @deprecated All accents use shared softer emerald via `listingSelectionStyles`. */
  compactSelectionAccent?: "default" | "aacGreen";
  /**
   * Agent viewing buyer-saved favorites: solid red heart on the photo only (no toolbar chip / no FavoriteButton box).
   * Omit the empty top chrome row when there is no selection checkbox and no interactive favorite chrome.
   */
  compactSavedHeartOverlay?: boolean;
  /** Agent buyer favorites: unheart removes the buyer's saved listing. */
  onCompactSavedHeartClick?: () => void;
  /**
   * When true with compact comments, draws a neutral rule between “Listed by” and the comment row.
   * Use only on agent client favorites — omit elsewhere.
   */
  compactListedByMessageSeparator?: boolean;
  /** Agent-only: bottom-right email affordance to the listing agent (internal queue). */
  showAgentEmailContact?: boolean;
  /** When set, used instead of reading contact fields from `listing` (e.g. map compact strips agent fields). */
  listingAgentContact?: ListingAgentContact | null;
  /** Optional subject prefill for the email composer. */
  listingEmailSubject?: string;
}
const ListingCard = ({
  listing,
  onReactivate,
  onDelete,
  viewMode = 'grid',
  showActions = true,
  onSelect,
  isSelected = false,
  hideMlsMeta = false,
  agentInfo = null,
  clientComment,
  chatMessages,
  hotSheetId,
  onNewMessage,
  onOpenChat,
  interestSignals,
  isHotSheetFavorite,
  supplementalAgentProfile = null,
  isFavorites = false,
  showCompactComments = false,
  compactAgentOwned = false,
  compactShowNeighborhood = false,
  compactDetailNavigateState,
  compactListingDetailTo,
  hideCompactFavorite = false,
  hideFavoriteTooltip = false,
  compactSelectionAccent: _compactSelectionAccent = "default",
  compactSavedHeartOverlay = false,
  onCompactSavedHeartClick,
  compactListedByMessageSeparator = false,
  showAgentEmailContact = false,
  listingAgentContact: listingAgentContactProp = null,
  listingEmailSubject: listingEmailSubjectProp,
}: ListingCardProps) => {
  const navigate = useNavigate();
  const { role } = useAuthRole();
  const suppressFavoriteHeartChrome = role === "agent" || role === "admin";

  const resolvedListingAgentContact = showAgentEmailContact
    ? (listingAgentContactProp ?? listingAgentContactFromRow(listing))
    : null;
  const resolvedListingEmailSubject =
    listingEmailSubjectProp ?? listingEmailSubjectFromRow(listing);

  const rowProfile = (listing as { agent_profile?: ListedByAgentProfile }).agent_profile;
  const listedByFromProfiles = resolveListedByAttribution(listing as ListedBySource, rowProfile ?? supplementalAgentProfile);

  const listedByAttribution =
    listedByFromProfiles ||
    (typeof agentInfo?.company === "string" && agentInfo.company.trim()
      ? agentInfo.company.trim()
      : typeof agentInfo?.name === "string" && agentInfo.name.trim()
        ? agentInfo.name.trim()
        : null);

  const brokerageAttribution = resolveBrokerageAttribution(
    listing as ListedBySource,
    rowProfile ?? supplementalAgentProfile,
  );
  const showUnifiedAttributionFooter = Boolean(
    showAgentEmailContact && (brokerageAttribution || resolvedListingAgentContact),
  );
  const [agentCount, setAgentCount] = useState<number>(0);
  const [buyerCount, setBuyerCount] = useState<number>(0);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [prospectDialogOpen, setProspectDialogOpen] = useState(false);
  const [marketInsightsOpen, setMarketInsightsOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [compactPhotoFailed, setCompactPhotoFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [quickOpenHouseDialogOpen, setQuickOpenHouseDialogOpen] = useState(false);
  const [quickOHType, setQuickOHType] = useState<'public' | 'broker'>('public');
  const [quickOHDate, setQuickOHDate] = useState('');
  const [quickOHStartTime, setQuickOHStartTime] = useState('');
  const [quickOHEndTime, setQuickOHEndTime] = useState('');
  const [quickOHNotes, setQuickOHNotes] = useState('');
  const [agentProfile, setAgentProfile] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    headshot_url?: string | null;
    company?: string | null;
  } | null>(null);

  useEffect(() => {
    loadMatchCount();
  }, [listing.id]);

  useEffect(() => {
    setCompactPhotoFailed(false);
  }, [listing.id, currentPhotoIndex]);

  // Fetch agent profile for grid view
  useEffect(() => {
    const fetchAgentProfile = async () => {
      if (!listing.agent_id || viewMode !== 'grid') return;
      
      try {
        const { data, error } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, headshot_url, company")
          .eq("id", listing.agent_id)
          .single();
        
        if (!error && data) {
          setAgentProfile(data);
        }
      } catch (error) {
        console.error("Error fetching agent profile:", error);
      }
    };

    fetchAgentProfile();
  }, [listing.agent_id, viewMode]);
  const loadMatchCount = async () => {
    try {
      setLoadingMatches(true);
      
      // Fetch all active hot sheets with user_id for agent counting
      const { data: hotSheets, error } = await supabase
        .from("hot_sheets")
        .select("id, criteria, user_id, client_id")
        .eq("is_active", true);

      if (error) throw error;
      
      if (!hotSheets || hotSheets.length === 0) {
        setAgentCount(0);
        setBuyerCount(0);
        return;
      }

      // Filter hot sheets using JavaScript matching logic
      const matchingSheets = hotSheets.filter((sheet) => {
        const criteria = sheet.criteria as any;
        if (!criteria) return false;

        // Price matching: effective price (single or range midpoint) within hot sheet bounds
        const eff = listingEffectiveNumericPrice(listing);
        if (criteria.min_price && (eff == null || eff < criteria.min_price)) return false;
        if (criteria.max_price && (eff == null || eff > criteria.max_price)) return false;

        // Bedrooms: listing must have >= hot sheet minimum (if specified)
        if (criteria.bedrooms !== null && criteria.bedrooms !== undefined) {
          if (listing.bedrooms === null || listing.bedrooms < criteria.bedrooms) return false;
        }

        // Bathrooms: listing must have >= hot sheet minimum (if specified)
        if (criteria.bathrooms !== null && criteria.bathrooms !== undefined) {
          if (listing.bathrooms === null || listing.bathrooms < criteria.bathrooms) return false;
        }

        // City matching: only if specified in hot sheet criteria
        if (criteria.city && criteria.city.trim() !== "") {
          if (!listing.city || listing.city.toLowerCase() !== criteria.city.toLowerCase()) return false;
        }

        // State matching: only if specified in hot sheet criteria
        if (criteria.state && criteria.state.trim() !== "") {
          if (!listing.state || listing.state.toLowerCase() !== criteria.state.toLowerCase()) return false;
        }

        // Property type matching: if specified in hot sheet
        if (criteria.property_type && criteria.property_type.trim() !== "") {
          const listingType = propertyTypeToEnum(listing.property_type || "");
          if (!listingType || listingType !== criteria.property_type) return false;
        }

        // Listing type matching: if specified (for_sale vs for_rent)
        if (criteria.listing_type && criteria.listing_type.trim() !== "") {
          if (!listing.listing_type || listing.listing_type !== criteria.listing_type) return false;
        }

        return true;
      });

      if (matchingSheets.length === 0) {
        setAgentCount(0);
        setBuyerCount(0);
        return;
      }

      // Count unique agents
      const uniqueAgents = new Set(matchingSheets.map(s => s.user_id));
      setAgentCount(uniqueAgents.size);

      // Count prospective buyers via hot_sheet_clients join table
      const matchingSheetIds = matchingSheets.map(s => s.id);
      const { data: hotSheetClients } = await supabase
        .from("hot_sheet_clients")
        .select("client_id, hot_sheet_id")
        .in("hot_sheet_id", matchingSheetIds);

      // Sheets that have linked clients via hot_sheet_clients
      const sheetsWithClients = new Set((hotSheetClients || []).map(hsc => hsc.hot_sheet_id));
      const uniqueClients = new Set((hotSheetClients || []).map(hsc => hsc.client_id));
      
      // Sheets with no linked clients (consumer-created) count as 1 buyer each
      // Also count sheets with a direct client_id but no hot_sheet_clients entries
      const sheetsWithNoClients = matchingSheets.filter(s => !sheetsWithClients.has(s.id)).length;

      setBuyerCount(uniqueClients.size + sheetsWithNoClients);
    } catch (error) {
      console.error("Error loading match count:", error);
    } finally {
      setLoadingMatches(false);
    }
  };
  
  const handleQuickAddOpenHouse = async () => {
    if (!quickOHDate || !quickOHStartTime || !quickOHEndTime) {
      toast.error("Please fill in date and time");
      return;
    }
    
    try {
      const newOpenHouse = {
        type: quickOHType,
        date: quickOHDate,
        start_time: quickOHStartTime,
        end_time: quickOHEndTime,
        notes: quickOHNotes
      };
      
      const currentOpenHouses = listing.open_houses || [];
      const updatedOpenHouses = [...currentOpenHouses, newOpenHouse];
      
      const { error } = await supabase
        .from('listings')
        .update({ open_houses: updatedOpenHouses })
        .eq('id', listing.id);
      
      if (error) throw error;
      
      setQuickOHDate('');
      setQuickOHStartTime('');
      setQuickOHEndTime('');
      setQuickOHNotes('');
      setQuickOpenHouseDialogOpen(false);
      
      toast.success("Open house added successfully!");
      window.location.reload();
    } catch (error) {
      console.error('Error adding open house:', error);
      toast.error('Failed to add open house');
    }
  };

  const handleDelete = async () => {
    console.log("Delete clicked for listing:", {
      id: listing.id,
      status: listing.status,
      address: listing.address,
      agent_id: listing.agent_id
    });
    
    setDeleting(true);
    try {
      // Use backend function that handles cascading deletes and RLS
      const { data, error } = await supabase.rpc('delete_draft_listing', {
        p_listing_id: listing.id,
      });
      
      if (error) {
        console.error("RPC error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log("Draft deleted successfully:", listing.id);
      toast.success("Draft listing deleted successfully");
      onDelete?.(listing.id);
    } catch (error: any) {
      console.error("Error deleting draft listing:", error);
      // Show the specific error message from the backend
      toast.error(error?.message || "Failed to delete draft listing");
    } finally {
      setDeleting(false);
    }
  };
  const displayPrice = formatListingPriceDisplay(listing) ?? "—";
  const listingPhotos = normalizeListingPhotos(listing?.photos);
  const getPhotoByIndex = (index: number) => {
    if (listingPhotos.length > 0) {
      const photo = listingPhotos[index];
      if (!photo) return null;

      // If it's a string, assume it's already a URL
      if (typeof photo === 'string') {
        return photo;
      }

      // If it's an object with a url property
      const p = photo as { url?: string };
      if (p.url) {
        // Check if it's a full URL or a storage path
        if (p.url.startsWith('http')) {
          return p.url;
        }
        // If it's a storage path, construct the public URL
        const {
          data
        } = supabase.storage.from('listing-photos').getPublicUrl(p.url);
        return data.publicUrl;
      }
    }
    return null;
  };
  
  const getFirstPhoto = () => {
    return getPhotoByIndex(0);
  };
  
  const getTotalPhotos = () => listingPhotos.length;
  
  const handlePreviousPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : getTotalPhotos() - 1);
  };
  
  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => prev < getTotalPhotos() - 1 ? prev + 1 : 0);
  };
  // Helper to format 24-hour time to 12-hour AM/PM
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const hasUpcomingOpenHouse = () => {
    if (!listing.open_houses || !Array.isArray(listing.open_houses)) return false;
    const now = new Date();
    return listing.open_houses.some((oh: any) => {
      const ohEndDateTime = new Date(`${oh.date}T${oh.end_time}:00`);
      return ohEndDateTime > now;
    });
  };
  const getNextOpenHouse = () => {
    if (!listing.open_houses || !Array.isArray(listing.open_houses)) return null;
    const now = new Date();
    const upcoming = listing.open_houses.filter((oh: any) => {
      const ohEndDateTime = new Date(`${oh.date}T${oh.end_time}:00`);
      return ohEndDateTime > now;
    }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] || null;
  };
  const photoUrl = getFirstPhoto();
  const nextOpenHouse = getNextOpenHouse();
  const { statusBanner, priceChangeBanner, openHouseBanner } = useListingBanners({
    id: listing.id,
    status: listing.status,
    is_relisting: listing.is_relisting,
    open_houses: listing.open_houses,
  });

  // Color coding for match count (based on buyer count)
  const totalMatchCount = buyerCount;
  const getMatchButtonStyle = () => {
    if (totalMatchCount === 0) {
      return {
        variant: "outline" as const,
        className: "border-muted-foreground/20 text-muted-foreground hover:bg-muted"
      };
    } else if (totalMatchCount >= 10) {
      // High demand - green
      return {
        variant: "default" as const,
        className: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
      };
    } else if (totalMatchCount >= 5) {
      // Medium demand - yellow/amber
      return {
        variant: "default" as const,
        className: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
      };
    } else {
      // Low demand - blue/default
      return {
        variant: "outline" as const,
        className: "border-border text-foreground hover:bg-muted"
      };
    }
  };

  // Build the match label for display
  const getMatchLabel = () => {
    if (loadingMatches) return "...";
    return `${buyerCount} Buyer Match${buyerCount !== 1 ? 'es' : ''}`;
  };
  const matchButtonStyle = getMatchButtonStyle();
  const calculateDaysOnMarket = () => {
    // Use active_date (MLS date) if available, otherwise fall back to created_at
    const marketDate = listing.active_date || listing.created_at;
    if (!marketDate) return 0;
    const activeDate = new Date(marketDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - activeDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  const daysOnMarket = calculateDaysOnMarket();

  // Compact view (for HotSheets and search results)
  if (viewMode === 'compact') {
    const openListingDetail = () => {
      const detailPath = compactListingDetailTo ?? `/property/${listing.id}`;
      if (compactDetailNavigateState !== undefined) {
        navigate(detailPath, { state: compactDetailNavigateState });
        return;
      }
      navigate(detailPath);
    };
    const compactIdLabel = formatListingIdLabel(listing);

    const hasCommentThread = Boolean((chatMessages && chatMessages.length > 0) || clientComment);
    const compactCommentIconClass = cn(
      "h-3.5 w-3.5 shrink-0",
      hasCommentThread ? "text-[#0E56F5]" : "mt-0.5 text-neutral-400",
    );
    const legacyCommentRowSignals = Boolean(onOpenChat || hasCommentThread || agentInfo);
    /** `onOpenChat` alone enables the compact comment row (e.g. agent favorites → conversation Sheet) — no `hotSheetId` required. */
    const buyerCommentRowSignals = Boolean(
      (showCompactComments || onOpenChat) && (onOpenChat || hasCommentThread),
    );
    const showCompactCommentsRow = buyerCommentRowSignals || (!showCompactComments && legacyCommentRowSignals);

    const totalPhotos = getTotalPhotos();
    const compactPhotoUrl = compactAgentOwned ? getPhotoByIndex(0) : getPhotoByIndex(currentPhotoIndex);
    const showCarouselArrows = !compactAgentOwned && totalPhotos > 1;
    const showRemovableBuyerFavoriteHeart = compactSavedHeartOverlay;
    /** Agent hot-sheet activity: read-only filled heart when buyer saved the listing. */
    const showHotSheetFavoriteHeart =
      isHotSheetFavorite === true &&
      !compactSavedHeartOverlay &&
      (hideCompactFavorite || suppressFavoriteHeartChrome);
    const showInteractiveFavoriteButton =
      !hideCompactFavorite && !suppressFavoriteHeartChrome && !compactSavedHeartOverlay;
    const showHotSheetFavoriteBadge =
      isHotSheetFavorite === true && !hideCompactFavorite && !compactSavedHeartOverlay;

    const showFavoriteChrome =
      showRemovableBuyerFavoriteHeart ||
      showHotSheetFavoriteHeart ||
      showInteractiveFavoriteButton ||
      showHotSheetFavoriteBadge;

    const showCompactTopChromeRow =
      !compactAgentOwned && (Boolean(onSelect) || showFavoriteChrome);

    return <Card
        className={cn(
          "flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-[box-shadow,border-color] hover:shadow-md",
          isSelected ? listingSelectionCardCompactSelected : "border-zinc-200/90 hover:border-zinc-200",
        )}
        onClick={openListingDetail}
      >
        <div className="relative group flex-shrink-0">
          {/* Top overlay: shared h-9 row so shortlist chip and FavoriteButton square/circle share one center line — do not override FavoriteButton sizing. */}
          {showCompactTopChromeRow ? (
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-2 pt-2",
                onSelect && showFavoriteChrome
                  ? "justify-between"
                  : showFavoriteChrome
                    ? "justify-end"
                    : "justify-start",
              )}
            >
              {onSelect ? (
              <div className="pointer-events-auto flex h-9 min-w-[2.25rem] shrink-0 items-center justify-center">
                  <div
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(listing.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(listing.id);
                      }
                    }}
                    className={listingSelectionCheckboxClass(isSelected)}
                    title="Keep in shortlist for this visit"
                    aria-label={isSelected ? "Remove from shortlist" : "Add to shortlist for this visit"}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
              </div>
              ) : null}
              {showFavoriteChrome ? (
                <div
                  className="pointer-events-auto flex h-9 min-w-0 max-w-[calc(100%-3.5rem)] items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {showHotSheetFavoriteHeart ? (
                    <span
                      className="inline-flex h-9 shrink-0 items-center justify-center"
                      title="Buyer favorited on hot sheet"
                    >
                      <Heart
                        className="h-[22px] w-[22px] fill-[#FF2D55] stroke-white [stroke-width:2.25px] [paint-order:stroke_fill]"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    </span>
                  ) : null}
                  {showHotSheetFavoriteBadge ? (
                    <span className="inline-flex h-9 shrink-0 items-center justify-center" title="Favorited on hot sheet">
                      <Heart className="h-[22px] w-[22px] fill-[#FF2D55] text-[#FF2D55] stroke-[#FF2D55]" aria-hidden strokeWidth={1.5} />
                    </span>
                  ) : null}
                  {showRemovableBuyerFavoriteHeart ? (
                    onCompactSavedHeartClick ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompactSavedHeartClick();
                        }}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/35"
                        aria-label="Remove from favorites"
                      >
                        <Heart
                          className="h-[22px] w-[22px] fill-[#FF2D55] stroke-white [stroke-width:2.25px] [paint-order:stroke_fill]"
                          strokeWidth={2.25}
                          aria-hidden
                        />
                      </button>
                    ) : (
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
                        <Heart
                          className="h-[22px] w-[22px] fill-[#FF2D55] stroke-white [stroke-width:2.25px] [paint-order:stroke_fill]"
                          strokeWidth={2.25}
                          aria-hidden
                        />
                      </span>
                    )
                  ) : null}
                  {showInteractiveFavoriteButton ? (
                    <FavoriteButton
                      listingId={listing.id}
                      size="icon"
                      photoIcon
                      hideTooltip={hideFavoriteTooltip}
                      hotSheetId={hotSheetId}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {/* Neighborhood overlay — property type lives in content stack below price. */}
          {(!compactAgentOwned || compactShowNeighborhood) &&
            (listing.neighborhood || (listing as any).attom_data?.neighborhood) && (
            <div className="absolute bottom-2 right-2 z-10">
              <span className="inline-flex items-center rounded-full bg-neutral-900/90 px-2.5 py-1 text-xs font-medium text-white shadow-md backdrop-blur-sm">
                {listing.neighborhood || (listing as any).attom_data?.neighborhood}
              </span>
            </div>
          )}
          
          {/* Photo navigation arrows */}
          {showCarouselArrows && (
            <>
              <button
                onClick={handlePreviousPhoto}
                className="absolute left-1 top-1/2 -translate-y-1/2 z-10 bg-background/95 backdrop-blur-sm p-1 rounded-full shadow-lg transition-all hover:bg-background hover:scale-110"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <button
                onClick={handleNextPhoto}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 bg-background/95 backdrop-blur-sm p-1 rounded-full shadow-lg transition-all hover:bg-background hover:scale-110"
                aria-label="Next photo"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </button>
            </>
          )}
          
          <div className="relative h-48 w-full shrink-0 overflow-hidden bg-zinc-50">
            {compactPhotoUrl && !compactPhotoFailed ? (
              <img
                src={compactPhotoUrl}
                alt={listing.address ? `${listing.address}, ${listing.city}` : "Listing photo"}
                className="h-full w-full cursor-pointer object-cover"
                loading="lazy"
                onClick={openListingDetail}
                onError={() => setCompactPhotoFailed(true)}
              />
            ) : (
              <div className="h-full w-full bg-zinc-50" aria-hidden />
            )}
          </div>
          
          {/* Status Change Banner (top priority) */}
          {!compactAgentOwned && statusBanner && <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-xs font-bold px-2 py-1 text-center flex items-center justify-center gap-1`}>
              {statusBanner.iconType === 'sparkles' ? <Sparkles className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
              {statusBanner.text}
            </div>}
          
          {/* Price Change Banner (second priority) */}
          {!compactAgentOwned && priceChangeBanner && !statusBanner && <div className={`absolute top-0 left-0 right-0 ${priceChangeBanner.color} text-white text-xs font-bold px-2 py-1 text-center flex items-center justify-center gap-1`}>
              <TrendingDown className="w-3 h-3" />
              {priceChangeBanner.text}
            </div>}
          
          {/* Open House Banner (third priority) */}
          {!compactAgentOwned && openHouseBanner && !statusBanner && !priceChangeBanner && <div className={`absolute top-0 left-0 right-0 ${openHouseBanner.color} text-white text-xs font-bold px-2 py-1 text-center`}>
              {openHouseBanner.isBroker ? '🚙' : '🎈'} {openHouseBanner.text}
            </div>}
        </div>
        <CardContent className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 pb-2.5 pt-2">
          <div className="mb-0 flex min-w-0 items-start justify-between gap-2">
            <p
              onClick={openListingDetail}
              className="shrink-0 cursor-pointer text-[14px] font-semibold leading-tight tracking-tight text-neutral-900"
            >
              {displayPrice}
            </p>
            {!hideMlsMeta && compactIdLabel ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openListingDetail();
                }}
                className={cn(
                  LISTING_ID_NAV_CLASS,
                  "block min-w-0 max-w-[45%] truncate text-right text-[10px] leading-none tabular-nums",
                )}
                title={compactIdLabel}
              >
                {compactIdLabel}
              </button>
            ) : null}
          </div>

          <ListingCardPropertyTypeLine
            propertyType={listing.property_type}
            className="mt-0 text-[12px] leading-tight"
          />

          <ListingCardAddressLine
            listing={listing}
            singleLine
            className={listing.property_type ? "mt-0.5" : undefined}
            onClick={openListingDetail}
          />

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-neutral-900">
            {listing.bedrooms ? (
              <div className="flex items-center gap-1">
                <Bed className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" aria-hidden />
                <span className="font-medium">{listing.bedrooms}</span>
              </div>
            ) : null}
            {listing.bathrooms ? (
              <div className="flex items-center gap-1">
                <Bath className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" aria-hidden />
                <span className="font-medium">{listing.bathrooms}</span>
              </div>
            ) : null}
            {listing.square_feet ? (
              <div className="flex items-center gap-1">
                <Maximize className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" aria-hidden />
                <span className="font-medium">{listing.square_feet.toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1">
              <CircleParking className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" aria-hidden />
              <span className="font-medium">{listing.total_parking_spaces ?? listing.garage_spaces ?? 0}</span>
            </div>
            {daysOnMarket >= 0 ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">DOM</span>
                <span className="font-medium">{daysOnMarket}</span>
              </div>
            ) : null}
          </div>

          {!showUnifiedAttributionFooter && listedByAttribution ? (
            <p
              className="mt-0.5 truncate text-[10px] font-normal leading-snug text-neutral-500"
              title={listedByAttribution}
            >
              {listedByAttribution}
            </p>
          ) : null}

          <div
            className={cn(
              "flex w-full flex-col",
              (showCompactCommentsRow ||
                showUnifiedAttributionFooter ||
                interestSignals) &&
                "mt-auto",
            )}
          >
          {showUnifiedAttributionFooter ? (
            <ListingCardAttributionStrip
              brokerageName={brokerageAttribution}
              contact={resolvedListingAgentContact}
              defaultSubject={resolvedListingEmailSubject}
              className="mt-1"
            />
          ) : null}

          {interestSignals ? (
            <div className="w-full pt-1">
              <ListingInterestSignals
                savesCount={interestSignals.saves_count}
                commentsCount={interestSignals.comments_count}
                hotsheetMatchCount={interestSignals.hotsheet_match_count}
              />
            </div>
          ) : null}

          {/* Comment row — minimal on Favorites / hot-sheet grids; legacy row if agent attribution without buyer flag */}
          {showCompactCommentsRow && (
            <div
              role="group"
              aria-label="Listing comments and discussion"
              className={
                showCompactComments
                  ? cn(
                      "mt-2 w-full",
                      (compactListedByMessageSeparator ||
                        onOpenChat ||
                        showUnifiedAttributionFooter ||
                        interestSignals) &&
                        "border-t border-neutral-200 pt-2.5",
                      onOpenChat && showCompactComments && "cursor-pointer",
                    )
                  : "mt-auto flex w-full items-center justify-between gap-2 border-t border-border/40 pt-2"
              }
              onClick={(e) => {
                e.stopPropagation();
                if (showCompactComments && onOpenChat) {
                  onOpenChat();
                }
              }}
            >
              <div className={showCompactComments ? "min-w-0 w-full" : "flex-1 min-w-0"}>
                {chatMessages && chatMessages.length > 0 ? (
                  showCompactComments ? (
                    <button
                      type="button"
                      className="inline-flex w-full min-w-0 items-start gap-1.5 rounded-sm text-left text-[12px] text-neutral-500 transition-colors hover:text-neutral-800"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenChat?.();
                      }}
                    >
                      <MessageSquare className={compactCommentIconClass} aria-hidden />
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-neutral-600">
                          {chatMessages[chatMessages.length - 1].sender_role === "agent" ? "Agent" : "You"}:
                        </span>{" "}
                        {chatMessages[chatMessages.length - 1].comment}
                      </span>
                    </button>
                  ) : (
                    <div
                      className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/60 border border-border cursor-pointer hover:bg-muted transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenChat?.();
                      }}
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm leading-snug truncate">
                          <span className="font-medium">
                            {chatMessages[chatMessages.length - 1].sender_role === "agent" ? "You" : "Client"}:
                          </span>{" "}
                          &quot;{chatMessages[chatMessages.length - 1].comment}&quot;
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {chatMessages.length} message{chatMessages.length !== 1 ? "s" : ""} ›
                        </p>
                      </div>
                    </div>
                  )
                ) : !chatMessages?.length && clientComment ? (
                  showCompactComments ? (
                    <button
                      type="button"
                      className="inline-flex w-full min-w-0 items-start gap-1.5 rounded-sm text-left text-[12px] text-neutral-500 hover:text-neutral-800"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenChat?.();
                      }}
                    >
                      <MessageSquare className={compactCommentIconClass} aria-hidden />
                      <span className="min-w-0 truncate italic">{clientComment}</span>
                    </button>
                  ) : (
                    <div
                      className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/60 border border-border cursor-pointer hover:bg-muted transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenChat?.();
                      }}
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground italic text-sm leading-snug truncate">
                          Client: &quot;{clientComment}&quot;
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">1 message ›</p>
                      </div>
                    </div>
                  )
                ) : onOpenChat ? (
                  <button
                    type="button"
                    className="inline-flex w-full min-w-0 items-center justify-start gap-1.5 rounded-sm text-left text-[12px] text-neutral-500 transition-colors hover:text-neutral-900"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenChat();
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Add Comment
                  </button>
                ) : (
                  <span />
                )}
              </div>
              {!showCompactComments && agentInfo && !listedByAttribution && (
                <ListingAttribution
                  listingAgentName={agentInfo.name}
                  listingAgentCompany={agentInfo.company}
                />
              )}
            </div>
          )}
          </div>
          
          {showActions && (listing.status === 'active' || listing.status === 'coming_soon') && (
            <div className="pt-2 border-t mt-2 space-y-2">
              <Button size="sm" variant={matchButtonStyle.variant} className={`w-full ${matchButtonStyle.className}`} onClick={() => setProspectDialogOpen(true)} disabled={loadingMatches}>
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {getMatchLabel()}
              </Button>
              <div className="flex items-center gap-2 w-full">
                <span className="text-2xl animate-pulse">🎈</span>
                <Button size="sm" variant="outline" className="flex-1" onClick={(e) => {
                  e.stopPropagation();
                  setQuickOpenHouseDialogOpen(true);
                }}>
                  Schedule Open House
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <Dialog open={quickOpenHouseDialogOpen} onOpenChange={setQuickOpenHouseDialogOpen}>
          <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Open House</DialogTitle>
                <DialogDescription>
                  Add an open house for {listing.address}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={quickOHType === 'public' ? 'default' : 'outline'}
                      onClick={() => setQuickOHType('public')}
                      className="flex-1"
                    >
                      Public Open House
                    </Button>
                    <Button
                      type="button"
                      variant={quickOHType === 'broker' ? 'default' : 'outline'}
                      onClick={() => setQuickOHType('broker')}
                      className="flex-1"
                    >
                      Broker Open House
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quick-oh-date">Date</Label>
                  <Input
                    id="quick-oh-date"
                    type="date"
                    value={quickOHDate}
                    onChange={(e) => setQuickOHDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quick-oh-start">Start Time</Label>
                    <Input
                      id="quick-oh-start"
                      type="time"
                      value={quickOHStartTime}
                      onChange={(e) => setQuickOHStartTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quick-oh-end">End Time</Label>
                    <Input
                      id="quick-oh-end"
                      type="time"
                      value={quickOHEndTime}
                      onChange={(e) => setQuickOHEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quick-oh-notes">Notes (optional)</Label>
                  <Textarea
                    id="quick-oh-notes"
                    value={quickOHNotes}
                    onChange={(e) => setQuickOHNotes(e.target.value)}
                    placeholder="Any special instructions..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setQuickOpenHouseDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleQuickAddOpenHouse}>
                  Add Open House
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>;
  }
  if (viewMode === 'list') {
    return <>
      <ListingCardShell
        listing={listing}
        photoUrl={photoUrl}
        displayPrice={displayPrice}
        statusBanner={statusBanner}
        priceChangeBanner={priceChangeBanner}
        openHouseBanner={openHouseBanner}
        nextOpenHouse={nextOpenHouse}
        dateDisplay={listing.created_at ? format(new Date(listing.created_at), "MM/dd/yy") : null}
        onListingNumberClick={() => {
          sessionStorage.setItem('fromAgentDashboard', 'true');
          navigate(`/property/${listing.id}?from=my-listings`, { state: { fromAgentDashboard: true } });
        }}
        listedByLine={
          listedByAttribution ? (
            <p className="truncate text-[12px] font-normal text-neutral-500" title={`Listed by: ${listedByAttribution}`}>
              Listed by: {listedByAttribution}
            </p>
          ) : undefined
        }
        onClick={() => {
          sessionStorage.setItem('fromAgentDashboard', 'true');
          navigate(`/property/${listing.id}?from=my-listings`, { state: { fromAgentDashboard: true } });
        }}
        infoRowExtra={<>
          {listing.is_relisting && <>
            {listing.listing_number && <span>•</span>}
            <Badge variant="secondary" className="text-xs">Relisted</Badge>
          </>}
          {listing.listing_stats?.cumulative_active_days && listing.listing_stats.cumulative_active_days > daysOnMarket && <>
            <span>•</span>
            <Badge variant="secondary" className="text-xs">
              {listing.listing_stats.cumulative_active_days} total active
            </Badge>
          </>}
        </>}
        metadataSlot={
          (listing.status === LISTING_STATUS.ACTIVE || listing.status === LISTING_STATUS.COMING_SOON) && buyerCount > 0 ? (
            <Button
              size="sm"
              variant={matchButtonStyle.variant}
              onClick={(e) => { e.stopPropagation(); setProspectDialogOpen(true); }}
              disabled={loadingMatches}
              className={`text-xs ${matchButtonStyle.className}`}
            >
              <Users className="w-3 h-3 mr-1" />
              {getMatchLabel()}
            </Button>
          ) : undefined
        }
        actionsSlot={<>
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/agent/listings/edit/${listing.id}`); }} className="w-full">
            <Edit className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={(e) => {
            e.stopPropagation();
            sessionStorage.setItem('fromAgentDashboard', 'true');
            navigate(`/property/${listing.id}?from=my-listings`, { state: { fromAgentDashboard: true } });
          }} className="w-full">
            <Eye className="w-3 h-3 mr-1" /> View
          </Button>
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/analytics/${listing.id}`); }} className="w-full">
            <BarChart3 className="w-3 h-3 mr-1" /> Stats
          </Button>
          {listing.status === 'draft' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" onClick={(e) => e.stopPropagation()} className="w-full">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Draft Listing</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this draft listing? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex items-center gap-2 w-full">
            <span className="text-2xl animate-pulse">🎈</span>
            <Button size="sm" variant="outline" className="flex-1" onClick={(e) => {
              e.stopPropagation();
              setQuickOpenHouseDialogOpen(true);
            }}>
              Schedule OH
            </Button>
          </div>
          {listing.status === 'cancelled' && onReactivate && (
            <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); onReactivate(listing.id); }} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <RefreshCw className="w-3 h-3 mr-1" /> Reactivate
            </Button>
          )}
        </>}
      />
      <ReverseProspectDialog open={prospectDialogOpen} onOpenChange={setProspectDialogOpen} listing={listing} agentCount={agentCount} buyerCount={buyerCount} />
      <MarketInsightsDialog open={marketInsightsOpen} onOpenChange={setMarketInsightsOpen} listing={{
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zip_code: listing.zip_code,
        price: listing.price,
        property_type: listing.property_type
      }} />
      <Dialog open={quickOpenHouseDialogOpen} onOpenChange={setQuickOpenHouseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Open House</DialogTitle>
            <DialogDescription>
              Add an open house for {listing.address}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button type="button" variant={quickOHType === 'public' ? 'default' : 'outline'} onClick={() => setQuickOHType('public')} className="flex-1">
                  Public Open House
                </Button>
                <Button type="button" variant={quickOHType === 'broker' ? 'default' : 'outline'} onClick={() => setQuickOHType('broker')} className="flex-1">
                  Broker Open House
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-oh-date">Date</Label>
              <Input id="quick-oh-date" type="date" value={quickOHDate} onChange={(e) => setQuickOHDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quick-oh-start">Start Time</Label>
                <Input id="quick-oh-start" type="time" value={quickOHStartTime} onChange={(e) => setQuickOHStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-oh-end">End Time</Label>
                <Input id="quick-oh-end" type="time" value={quickOHEndTime} onChange={(e) => setQuickOHEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-oh-notes">Notes (optional)</Label>
              <Textarea id="quick-oh-notes" value={quickOHNotes} onChange={(e) => setQuickOHNotes(e.target.value)} placeholder="Any special instructions..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickOpenHouseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleQuickAddOpenHouse}>Add Open House</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
  }

  // Grid view - Clean design for listing search results
  const currentPhoto = getPhotoByIndex(currentPhotoIndex);
  const totalPhotos = getTotalPhotos();
  const basisSqft = listingEffectiveNumericPrice(listing);
  const pricePerSqft =
    listing.square_feet && listing.square_feet > 0 && basisSqft != null && basisSqft > 0
      ? Math.round(basisSqft / listing.square_feet)
      : null;
  const listingIdLabel = formatListingIdLabel(listing);

  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-[box-shadow,border-color] hover:border-neutral-300 hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)]",
        isSelected && listingSelectionCardGridSelected,
      )}
      onClick={() => navigate(`/property/${listing.id}`)}
    >
      {/* Photo Container with scrolling */}
      <div className="group relative aspect-[4/3]">
        {currentPhoto ? (
          <img 
            src={currentPhoto} 
            alt={listing.address} 
            className="h-full w-full object-cover" 
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-100">
            <Home className="h-12 w-12 text-neutral-400" />
          </div>
        )}
        
        {onSelect && (
          <div
            className="absolute top-2 left-2 z-20 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(listing.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(listing.id);
                }
              }}
              className={listingSelectionCheckboxClass(isSelected)}
              title="Keep in shortlist for this visit"
              aria-label={isSelected ? "Remove from shortlist" : "Add to shortlist for this visit"}
            >
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </div>
        )}
        
        {/* Photo Navigation Arrows */}
        {totalPhotos > 1 && (
          <>
            <button
              onClick={handlePreviousPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {/* Photo indicator dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {Array.from({ length: Math.min(totalPhotos, 5) }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full ${i === currentPhotoIndex % 5 ? 'bg-white' : 'bg-white/50'}`} 
                />
              ))}
              {totalPhotos > 5 && <span className="text-white text-xs ml-1">+{totalPhotos - 5}</span>}
            </div>
          </>
        )}
        
      </div>

      <CardContent className="p-3">
        {/* Price → property type → address */}
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold text-neutral-900">{displayPrice}</div>
            <ListingCardPropertyTypeLine propertyType={listing.property_type} className="mt-0.5" />
            <ListingCardAddressLine
              listing={listing}
              className={listing.property_type ? "mt-1" : "mt-1.5"}
            />
          </div>
          {pricePerSqft ? (
            <div className="shrink-0 text-right text-xs text-neutral-600">${pricePerSqft}/sqft</div>
          ) : null}
        </div>

        {/* Beds, Baths, SqFt */}
        <div className="mb-2 -mt-0.5 flex gap-4 text-base font-semibold text-neutral-900">
          {listing.bedrooms !== null && (
            <div className="flex items-center gap-1.5">
              <Bed className="h-5 w-5 text-neutral-500" />
              <span>{listing.bedrooms}</span>
            </div>
          )}
          {listing.bathrooms !== null && (
            <div className="flex items-center gap-1.5">
              <Bath className="h-5 w-5 text-neutral-500" />
              <span>{listing.bathrooms}</span>
            </div>
          )}
          {listing.square_feet !== null && (
            <div className="flex items-center gap-1.5">
              <Home className="h-5 w-5 text-neutral-500" />
              <span>{listing.square_feet.toLocaleString()}</span>
            </div>
          )}
        </div>

        {listedByAttribution && (
          <p
            className="mb-3 truncate text-[12px] font-normal text-neutral-500"
            title={`Listed by: ${listedByAttribution}`}
          >
            Listed by: {listedByAttribution}
          </p>
        )}

        {listingIdLabel ? (
          <div className="mb-3">
            <button
              type="button"
              className={cn(LISTING_ID_NAV_CLASS, "block text-left text-sm font-mono font-medium")}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/property/${listing.id}`);
              }}
            >
              {listingIdLabel}
            </button>
          </div>
        ) : null}

        {/* Divider */}
        <div className="my-3 border-t border-neutral-100" />

        {/* Agent Section */}
        {agentProfile ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={agentProfile.headshot_url || undefined} alt={`${agentProfile.first_name} ${agentProfile.last_name}`} />
              <AvatarFallback className="bg-neutral-800 text-white">
                <svg viewBox="0 0 34 34" className="h-5 w-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.6667 11.3333H11.3333V22.6667H22.6667V11.3333Z"/><path d="M2.83333 26.9167C2.83333 29.2542 4.74583 31.1667 7.08333 31.1667C9.42083 31.1667 11.3333 29.2542 11.3333 26.9167V22.6667H7.08333C4.74583 22.6667 2.83333 24.5792 2.83333 26.9167Z"/><path d="M7.08333 2.83333C4.74583 2.83333 2.83333 4.74583 2.83333 7.08333C2.83333 9.42083 4.74583 11.3333 7.08333 11.3333H11.3333V7.08333C11.3333 4.74583 9.42083 2.83333 7.08333 2.83333Z"/><path d="M31.1667 7.08333C31.1667 4.74583 29.2542 2.83333 26.9167 2.83333C24.5792 2.83333 22.6667 4.74583 22.6667 7.08333V11.3333H26.9167C29.2542 11.3333 31.1667 9.42083 31.1667 7.08333Z"/><path d="M26.9167 22.6667H22.6667V26.9167C22.6667 29.2542 24.5792 31.1667 26.9167 31.1667C29.2542 31.1667 31.1667 29.2542 31.1667 26.9167C31.1667 24.5792 29.2542 22.6667 26.9167 22.6667Z"/></svg>
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {agentProfile.first_name} {agentProfile.last_name}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {agentProfile.company ? (
                  <span className="truncate">{agentProfile.company}</span>
                ) : null}
              </div>
            </div>
            <ContactAgentDialog
              listingId={listing.id}
              agentId={agentProfile.id}
              listingAddress={formatListingEmailSubjectLocation(listing)}
              buttonSize="sm"
              buttonVariant="default"
            />
          </div>
        ) : agentInfo ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback className="bg-neutral-800 text-white">
                <svg viewBox="0 0 34 34" className="h-5 w-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.6667 11.3333H11.3333V22.6667H22.6667V11.3333Z"/><path d="M2.83333 26.9167C2.83333 29.2542 4.74583 31.1667 7.08333 31.1667C9.42083 31.1667 11.3333 29.2542 11.3333 26.9167V22.6667H7.08333C4.74583 22.6667 2.83333 24.5792 2.83333 26.9167Z"/><path d="M7.08333 2.83333C4.74583 2.83333 2.83333 4.74583 2.83333 7.08333C2.83333 9.42083 4.74583 11.3333 7.08333 11.3333H11.3333V7.08333C11.3333 4.74583 9.42083 2.83333 7.08333 2.83333Z"/><path d="M31.1667 7.08333C31.1667 4.74583 29.2542 2.83333 26.9167 2.83333C24.5792 2.83333 22.6667 4.74583 22.6667 7.08333V11.3333H26.9167C29.2542 11.3333 31.1667 9.42083 31.1667 7.08333Z"/><path d="M26.9167 22.6667H22.6667V26.9167C22.6667 29.2542 24.5792 31.1667 26.9167 31.1667C29.2542 31.1667 31.1667 29.2542 31.1667 26.9167C31.1667 24.5792 29.2542 22.6667 26.9167 22.6667Z"/></svg>
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <ListingAttribution
                listingAgentName={agentInfo.name}
                listingAgentCompany={agentInfo.company}
                variant="block"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback className="bg-neutral-800 text-white">
                <svg viewBox="0 0 34 34" className="h-5 w-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.6667 11.3333H11.3333V22.6667H22.6667V11.3333Z"/><path d="M2.83333 26.9167C2.83333 29.2542 4.74583 31.1667 7.08333 31.1667C9.42083 31.1667 11.3333 29.2542 11.3333 26.9167V22.6667H7.08333C4.74583 22.6667 2.83333 24.5792 2.83333 26.9167Z"/><path d="M7.08333 2.83333C4.74583 2.83333 2.83333 4.74583 2.83333 7.08333C2.83333 9.42083 4.74583 11.3333 7.08333 11.3333H11.3333V7.08333C11.3333 4.74583 9.42083 2.83333 7.08333 2.83333Z"/><path d="M31.1667 7.08333C31.1667 4.74583 29.2542 2.83333 26.9167 2.83333C24.5792 2.83333 22.6667 4.74583 22.6667 7.08333V11.3333H26.9167C29.2542 11.3333 31.1667 9.42083 31.1667 7.08333Z"/><path d="M26.9167 22.6667H22.6667V26.9167C22.6667 29.2542 24.5792 31.1667 26.9167 31.1667C29.2542 31.1667 31.1667 29.2542 31.1667 26.9167C31.1667 24.5792 29.2542 22.6667 26.9167 22.6667Z"/></svg>
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground">
                Listing Agent
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
export default ListingCard;