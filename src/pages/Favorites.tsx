import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
// Navigation removed - rendered globally in App.tsx
import { Card } from "@/components/ui/card";
import ListingCard from "@/components/ListingCard";
import { ListingConversationSheet } from "@/components/messaging/ListingConversationSheet";
import {
  fetchListingConversationMessagesMap,
  mergeListingThreadMessages,
  type ListingCardThreadMessage,
} from "@/lib/listingConversationThread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PropertyMap from "@/components/PropertyMap";
import { formatListingShareEmailStreetLine } from "@/lib/buildHotSheetShareEmailHtml";
import { buildNewListingSharedEmailSubject } from "@/lib/listingEmailSubject";
import {
  type ListingRecord,
  type AgentOfficeRecord,
  getPrimaryPhotoUrl,
  ListingImage,
  formatBrokerageLine,
  resolveListingBrokerage,
} from "@/components/buyer/buyerListingDisplay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuthRole } from "@/hooks/useAuthRole";
import { ArrowLeft, MapPin, Heart } from "lucide-react";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { toast } from "sonner";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { buyerFavoritesSplitPane } from "@/lib/buyerUi";

/** Buyer Favorites shell — wide split layout; padding aligned with other buyer portal pages. */
const BUYER_FAVORITES_MAIN =
  "mx-auto flex w-full min-h-0 max-w-[1800px] flex-1 flex-col px-6 pt-4 pb-3 md:px-8";

/** Fits below global agent banner + BuyerShell top nav (split map/list scroll). */
const BUYER_FAVORITES_VIEWPORT = "flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col bg-white";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { Skeleton } from "@/components/ui/skeleton";

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  unit_number?: string | null;
  condo_details?: unknown;
  price: number;
  price_range_min?: number | null;
  price_range_max?: number | null;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  property_type: string;
  listing_type: string;
  status: string;
  photos: any[];
  agent_id: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface Favorite {
  id: string;
  listing_id: string;
  created_at: string;
  listings: Listing;
}

interface FavoritesProps {
  isPublicMode?: boolean;
  isAgentMode?: boolean;
  isBuyerMode?: boolean;
}

/** Default map view when no favorites have coordinates (UI only; not written to listings). */
const BOSTON_DEFAULT_MAP_CENTER = { lat: 42.3601, lng: -71.0589 } as const;

const propertyUrlWithFavoritesContext = (listingId: string) => `/property/${listingId}?from=favorites`;

/** PostgREST may return `listings` as a one-row array; map expects a single row with lat/lng. */
function normalizeEmbeddedListing(
  row: { listings: Listing | Listing[] | null } | { listings?: unknown },
): Listing | null {
  const raw = row.listings as unknown;
  if (raw == null) return null;
  if (Array.isArray(raw)) return (raw[0] as Listing | undefined) ?? null;
  return raw as Listing;
}

function parseOptionalCoord(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Shapes to PropertyMap `listings` (same field names as BuyerMapSearch / ListingRecord). */
function toPropertyMapListings(
  records: ListingRecord[],
): {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  latitude: number | null;
  longitude: number | null;
}[] {
    return records.map((rec) => {
    const priceNum =
      typeof rec.price === "number" && Number.isFinite(rec.price) ? rec.price : Number(rec.price);
    const ex = rec as unknown as Record<string, unknown>;
    const lat = parseOptionalCoord(rec.latitude) ?? parseOptionalCoord(ex.lat);
    const lng = parseOptionalCoord(rec.longitude) ?? parseOptionalCoord(ex.lng);
    const prMin = typeof rec.price_range_min === "number" ? rec.price_range_min : null;
    const prMax = typeof rec.price_range_max === "number" ? rec.price_range_max : null;
    const price =
      Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null;
    return {
      id: String(rec.id),
      address: rec.address ?? "",
      city: rec.city ?? "",
      state: rec.state ?? "",
      zip_code: rec.zip_code ?? "",
      price,
      price_range_min: prMin,
      price_range_max: prMax,
      latitude: lat,
      longitude: lng,
    };
  });
}

const Favorites = ({
  isPublicMode = false,
  isAgentMode = false,
  isBuyerMode = false,
}: FavoritesProps) => {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuthRole();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [selectedFavoriteIds, setSelectedFavoriteIds] = useState<Set<string>>(new Set());
  /** Same semantics as `sessionKeptIds` in BuyerMapSearch: listing id → checked in the current list */
  const [sessionKeptListingIds, setSessionKeptListingIds] = useState<Set<string>>(() => new Set());
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToEmail, setShareToEmail] = useState("");
  const [shareSubject, setShareSubject] = useState("Share selected listings");
  const [shareMessage, setShareMessage] = useState("");
  const [shareSending, setShareSending] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showKeptOnly, setShowKeptOnly] = useState(false);
  const [officeByAgentId, setOfficeByAgentId] = useState<Map<string, string | null>>(new Map());
  const [listedByProfileByAgentId, setListedByProfileByAgentId] = useState<Map<string, ListedByAgentProfile>>(
    () => new Map(),
  );
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const buyerMode = isBuyerMode || (!isAgentMode && !isPublicMode);
  /** When buyer is linked to hot sheets — load `hot_sheet_comments` tied to favorites */
  const [favoritesHotSheetForComments, setFavoritesHotSheetForComments] = useState<string | null>(null);
  const [favoritesChatMap, setFavoritesChatMap] = useState<Record<string, ListingCardThreadMessage[]>>({});
  const [favoritesChatOpen, setFavoritesChatOpen] = useState(false);
  const [favoritesChatListingId, setFavoritesChatListingId] = useState<string | null>(null);
  /** `undefined` = not resolved yet (omit inbox sync); `null` = sheet has no owner */
  const [favoritesConversationAgentUserId, setFavoritesConversationAgentUserId] = useState<
    string | null | undefined
  >(undefined);

  const handleFavoritesChatMessage = useCallback((msg: ListingCardThreadMessage) => {
    setFavoritesChatMap((prev) => {
      const lid = msg.listing_id;
      const cur = prev[lid] ?? [];
      if (cur.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [lid]: [...cur, msg] };
    });
  }, []);

  useEffect(() => {
    if (!buyerMode || favorites.length === 0) {
      setFavoritesHotSheetForComments(null);
      setFavoritesChatMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled) return;
      const { data: hscRows, error: hscErr } = await supabase.from("hot_sheet_clients").select("hot_sheet_id");
      if (hscErr || cancelled) return;
      const hsIds = [...new Set((hscRows ?? []).map((r: { hot_sheet_id: string }) => r.hot_sheet_id))];
      if (hsIds.length === 0) {
        if (!cancelled) {
          setFavoritesHotSheetForComments(null);
          setFavoritesChatMap({});
        }
        return;
      }
      const primaryHs = hsIds[0];
      const listingIds = favorites.map((f) => f.listings?.id).filter((id): id is string => Boolean(id));
      if (listingIds.length === 0) return;

      const { data: rows, error } = await supabase
        .from("hot_sheet_comments")
        .select("id, hot_sheet_id, listing_id, comment, sender_role, sender_id, created_at")
        .in("hot_sheet_id", hsIds)
        .in("listing_id", listingIds)
        .order("created_at", { ascending: true });

      if (error || cancelled) return;
      const map: Record<string, ListingCardThreadMessage[]> = {};
      for (const row of rows ?? []) {
        const lid = row.listing_id;
        if (!lid) continue;
        if (!map[lid]) map[lid] = [];
        map[lid].push(row as ListingCardThreadMessage);
      }

      let merged = map;
      const { data: hsRow } = await supabase
        .from("hot_sheets")
        .select("user_id")
        .eq("id", primaryHs)
        .maybeSingle();
      const agentId = typeof hsRow?.user_id === "string" ? hsRow.user_id.trim() : "";
      if (agentId && listingIds.length > 0) {
        const convoMap = await fetchListingConversationMessagesMap(
          listingIds,
          auth.user.id,
          agentId,
          agentId,
        );
        merged = mergeListingThreadMessages(convoMap, map);
      }

      if (!cancelled) {
        setFavoritesHotSheetForComments(primaryHs);
        setFavoritesChatMap(merged);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buyerMode, favorites]);

  const favoritesDrawerHotSheetId = useMemo(() => {
    if (!favoritesChatListingId) return null;
    const msgs = favoritesChatMap[favoritesChatListingId];
    if (msgs?.length) return msgs[msgs.length - 1].hot_sheet_id;
    return favoritesHotSheetForComments;
  }, [favoritesChatListingId, favoritesChatMap, favoritesHotSheetForComments]);

  useEffect(() => {
    if (!buyerMode || !favoritesDrawerHotSheetId) {
      setFavoritesConversationAgentUserId(undefined);
      return;
    }
    setFavoritesConversationAgentUserId(undefined);
    let cancelled = false;
    void supabase
      .from("hot_sheets")
      .select("user_id")
      .eq("id", favoritesDrawerHotSheetId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("hot_sheets lookup for messaging sync:", error);
          setFavoritesConversationAgentUserId(null);
          return;
        }
        setFavoritesConversationAgentUserId(data?.user_id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [buyerMode, favoritesDrawerHotSheetId]);

  useEffect(() => {
    // Auth gating is owned by RouteGuard + global useAuthRole — never call navigate("/auth") here.
    if (authLoading) return;
    if (!authUser) {
      // RouteGuard will redirect; leave loading state in place to avoid flashing empty UI.
      return;
    }
    setUser(authUser);
    void fetchFavorites(authUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser?.id]);

  useEffect(() => {
    if (favorites.length === 0) {
      setOfficeByAgentId(new Map());
      setListedByProfileByAgentId(new Map());
      return;
    }
    const agentIds = Array.from(
      new Set(favorites.map((f) => f.listings?.agent_id).filter((id): id is string => Boolean(id))),
    );
    if (agentIds.length === 0) {
      setOfficeByAgentId(new Map());
      setListedByProfileByAgentId(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("id, company, office_name, first_name, last_name")
        .in("id", agentIds);
      if (error || cancelled) return;
      const offices = new Map<string, string | null>();
      const profiles = new Map<string, ListedByAgentProfile>();
      for (const r of data || []) {
        const row = r as AgentOfficeRecord & { first_name?: string; last_name?: string };
        offices.set(row.id, row.office_name?.trim() || row.company?.trim() || null);
        profiles.set(row.id, {
          company: row.company ?? null,
          office_name: row.office_name ?? null,
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
        });
      }
      if (!cancelled) {
        setListedByProfileByAgentId(profiles);
        setOfficeByAgentId(buyerMode ? offices : new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buyerMode, favorites]);

  const fetchFavorites = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("favorites")
        .select(`
          id,
          listing_id,
          created_at,
          listings (
            id,
            address,
            city,
            state,
            zip_code,
            price,
            price_range_min,
            price_range_max,
            bedrooms,
            bathrooms,
            square_feet,
            property_type,
            listing_type,
            status,
            photos,
            agent_id,
            latitude,
            longitude
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      let normalized = (data || [])
        .map((row: { listings?: unknown } & Record<string, unknown>) => {
          const raw = row.listings;
          const single = Array.isArray(raw) ? (raw[0] as unknown) : raw;
          if (single == null) return null;
          return { ...row, listings: single } as Favorite;
        })
        .filter((r): r is Favorite => r != null);

      const idsMissingCoords = normalized
        .map((f) => f.listings)
        .filter((l): l is Listing => Boolean(l))
        .filter((l) => parseOptionalCoord(l.latitude) == null || parseOptionalCoord(l.longitude) == null)
        .map((l) => l.id);

      if (idsMissingCoords.length > 0) {
        const { data: coordRows, error: coordErr } = await supabase
          .from("listings")
          .select("id, latitude, longitude")
          .in("id", idsMissingCoords);
        if (!coordErr && coordRows?.length) {
          const byId = new Map(coordRows.map((r) => [r.id, r]));
          normalized = normalized.map((f) => {
            const l = f.listings;
            if (
              !l ||
              (parseOptionalCoord(l.latitude) != null && parseOptionalCoord(l.longitude) != null)
            ) {
              return f;
            }
            const patch = byId.get(l.id);
            if (!patch) return f;
            return {
              ...f,
              listings: {
                ...l,
                latitude: patch.latitude ?? l.latitude,
                longitude: patch.longitude ?? l.longitude,
              },
            };
          });
        }
      }

      setFavorites(normalized);
    } catch (error: any) {
      console.error("Error fetching favorites:", error);
      toast.error(buyerMode ? "Failed to load your saved homes" : "Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getMainPhoto = (photos: any[]) => {
    if (!photos || photos.length === 0) return "/placeholder.svg";
    const p = photos[0];
    if (typeof p === "string") return p;
    if (p && typeof p === "object") return (p as { url?: string }).url ?? "/placeholder.svg";
    return "/placeholder.svg";
  };

  const sortedFavorites = useMemo(() => {
    const next = [...favorites];
    if (sortBy === "price_asc") {
      next.sort((a, b) => (a.listings?.price || 0) - (b.listings?.price || 0));
      return next;
    }
    if (sortBy === "price_desc") {
      next.sort((a, b) => (b.listings?.price || 0) - (a.listings?.price || 0));
      return next;
    }
    next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return next;
  }, [favorites, sortBy]);

  const sortedFavoritesWithListing = useMemo(
    () => sortedFavorites.filter((f) => normalizeEmbeddedListing(f) != null),
    [sortedFavorites],
  );

  const displayFavorites = useMemo(() => {
    if (!buyerMode || !showKeptOnly) return sortedFavoritesWithListing;
    return sortedFavoritesWithListing.filter((f) => {
      const lid = normalizeEmbeddedListing(f)?.id;
      return lid != null && sessionKeptListingIds.has(lid);
    });
  }, [buyerMode, showKeptOnly, sortedFavoritesWithListing, sessionKeptListingIds]);

  /** Matches BuyerMapSearch: listings kept in the current “display” list, used for share */
  const favoritesForShare = useMemo(() => {
    if (buyerMode) {
      return displayFavorites.filter((f) => {
        const lid = normalizeEmbeddedListing(f)?.id;
        return lid != null && sessionKeptListingIds.has(lid);
      });
    }
    return sortedFavoritesWithListing.filter((fav) => selectedFavoriteIds.has(fav.id));
  }, [buyerMode, displayFavorites, sortedFavoritesWithListing, sessionKeptListingIds, selectedFavoriteIds]);

  const favoriteListingIdsForShare = useMemo(
    () =>
      favoritesForShare
        .map((f) => normalizeEmbeddedListing(f)?.id)
        .filter((id): id is string => Boolean(id)),
    [favoritesForShare],
  );

  const clearShareSelection = useCallback(() => {
    if (buyerMode) {
      const sharedSet = new Set(favoriteListingIdsForShare);
      setSessionKeptListingIds((prev) => {
        const next = new Set(prev);
        sharedSet.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedFavoriteIds(new Set());
    }
  }, [buyerMode, favoriteListingIdsForShare]);

  const buyerFavoritesShareTriggerClass =
    "h-7 gap-0 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90 disabled:pointer-events-none disabled:opacity-40 [&_svg]:mr-1 [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:text-neutral-600";

  const listingRowsForMap: Favorite[] = useMemo(
    () => (buyerMode ? displayFavorites : sortedFavoritesWithListing),
    [buyerMode, displayFavorites, sortedFavoritesWithListing],
  );

  const displayListingRecords: ListingRecord[] = useMemo(() => {
    return listingRowsForMap
      .map((fav): ListingRecord | null => {
        const l = normalizeEmbeddedListing(fav);
        if (!l) return null;
        const fallback = l.agent_id ? officeByAgentId.get(l.agent_id) ?? null : null;
        const raw = l as unknown as Record<string, unknown>;
        return {
          id: l.id,
          agent_id: l.agent_id,
          address: l.address,
          city: l.city,
          state: l.state,
          zip_code: l.zip_code,
          price: l.price,
          price_range_min: l.price_range_min ?? null,
          price_range_max: l.price_range_max ?? null,
          status: l.status,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          square_feet: l.square_feet,
          latitude: (l.latitude ?? raw.lat) as ListingRecord["latitude"],
          longitude: (l.longitude ?? raw.lng) as ListingRecord["longitude"],
          photos: Array.isArray(l.photos) ? l.photos.filter((photo): photo is string => typeof photo === "string") : null,
          property_type: l.property_type,
          list_office: fallback,
        };
      })
      .filter((r): r is ListingRecord => r != null);
  }, [listingRowsForMap, officeByAgentId]);

  const propertyMapListings = useMemo(
    () => toPropertyMapListings(displayListingRecords),
    [displayListingRecords],
  );

  const buyerHasKeptForActions = useMemo(
    () => sortedFavorites.some((f) => sessionKeptListingIds.has(f.listings.id)),
    [sortedFavorites, sessionKeptListingIds],
  );

  const visibleSelectionState = useMemo(() => {
    if (!buyerMode) {
      return { allVisible: false, someVisible: false, noneVisible: true };
    }
    const n = displayFavorites.length;
    if (n === 0) return { allVisible: false, someVisible: false, noneVisible: true };
    const selected = displayFavorites.filter((f) => {
      const lid = normalizeEmbeddedListing(f)?.id;
      return lid != null && sessionKeptListingIds.has(lid);
    }).length;
    if (selected === 0) return { allVisible: false, someVisible: false, noneVisible: true };
    if (selected === n) return { allVisible: true, someVisible: false, noneVisible: false };
    return { allVisible: false, someVisible: true, noneVisible: false };
  }, [buyerMode, displayFavorites, sessionKeptListingIds]);

  const addAllVisible = useCallback(() => {
    if (!buyerMode) return;
    setSessionKeptListingIds((prev) => {
      const next = new Set(prev);
      displayFavorites.forEach((f) => {
        const id = normalizeEmbeddedListing(f)?.id;
        if (id) next.add(id);
      });
      return next;
    });
  }, [buyerMode, displayFavorites]);

  const unselectAllVisible = useCallback(() => {
    if (!buyerMode) return;
    setSessionKeptListingIds((prev) => {
      const next = new Set(prev);
      displayFavorites.forEach((f) => {
        const id = normalizeEmbeddedListing(f)?.id;
        if (id) next.delete(id);
      });
      return next;
    });
  }, [buyerMode, displayFavorites]);

  const handleMarkerSelect = (listingId: string) => {
    setSelectedListingId(listingId);
    const el = cardRefs.current[listingId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  };

  useEffect(() => {
    if (!selectedListingId) return;
    const still = displayListingRecords.some((l) => l.id === selectedListingId);
    if (!still) setSelectedListingId(null);
  }, [displayListingRecords, selectedListingId]);

  useEffect(() => {
    if (!import.meta.env.DEV || !buyerMode) return;
    const missing: string[] = [];
    for (const fav of displayFavorites) {
      const l = normalizeEmbeddedListing(fav);
      if (!l) continue;
      if (parseOptionalCoord(l.latitude) == null || parseOptionalCoord(l.longitude) == null) {
        missing.push(l.id);
      }
    }
    if (missing.length) {
      console.warn(
        "[Favorites] Listings with missing map coordinates (pins omitted; coordinates not invented):",
        missing,
      );
    }
  }, [buyerMode, displayFavorites]);

  useEffect(() => {
    if (!buyerMode) return;
    if (showKeptOnly && sessionKeptListingIds.size === 0) {
      setShowKeptOnly(false);
    }
  }, [buyerMode, showKeptOnly, sessionKeptListingIds.size]);

  useEffect(() => {
    if (!buyerMode) return;
    const keep = new Set(
      favorites
        .map((f) => normalizeEmbeddedListing(f)?.id)
        .filter((id): id is string => Boolean(id)),
    );
    setSessionKeptListingIds((prev) => {
      let next: Set<string> | null = null;
      for (const lid of prev) {
        if (!keep.has(lid)) {
          if (!next) next = new Set(prev);
          next.delete(lid);
        }
      }
      return next ?? prev;
    });
  }, [buyerMode, favorites]);

  const toggleSelectFavorite = (favoriteId: string) => {
    setSelectedFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(favoriteId)) next.delete(favoriteId);
      else next.add(favoriteId);
      return next;
    });
  };

  const toggleSessionKeepListing = (listingId: string) => {
    setSessionKeptListingIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  };

  const shareVisibleSelected = useCallback(() => {
    if (favoritesForShare.length === 0) return;
    if (favoritesForShare.length === 1) {
      const listing = normalizeEmbeddedListing(favoritesForShare[0]);
      setShareSubject(
        listing ? buildNewListingSharedEmailSubject(listing) : "New listing shared",
      );
    } else {
      setShareSubject(`Share selected listings (${favoritesForShare.length})`);
    }
    setShareMessage("Here are some listings I wanted to share:");
    setShareModalOpen(true);
  }, [favoritesForShare]);

  const handleSendShareEmail = useCallback(() => {
    const run = async () => {
      if (!shareToEmail.trim() || !shareSubject.trim() || !shareMessage.trim()) {
        toast.error("Please fill in To email, Subject, and Message");
        return;
      }

      setShareSending(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (!authUser) {
          toast.error("You must be logged in to send email");
          return;
        }

        const recipientEmail = shareToEmail.trim();
        const recipientName = recipientEmail.split("@")[0] || "Recipient";

        const escapeHtml = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

        const aacPrimaryCta = "#0E56F5";
        const sharePhotoH = 150;
        const shareImgColW = 240;
        const shareRows = favoritesForShare;
        const shareRowsWithListing = shareRows
          .map((fav) => normalizeEmbeddedListing(fav))
          .filter((listing): listing is Listing => listing != null);

        if (buyerMode) {
          const listingCardsHtml = shareRowsWithListing
            .map((listing) => {
              const listingUrl = `${window.location.origin}/consumer-property/${listing.id}`;
              const price = listing.price ? `$${listing.price.toLocaleString()}` : "Price unavailable";
              const address = escapeHtml(formatListingShareEmailStreetLine(listing));
              const cityStateZip = escapeHtml(
                `${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`.trim(),
              );
              const photoUrl = getPrimaryPhotoUrl(listing?.photos ?? []);
              const safePhoto = photoUrl ? escapeHtml(photoUrl) : "";
              return [
                `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:14px 0;background:#ffffff;box-shadow:0 1px 6px rgba(17,24,39,0.06);">`,
                `<tr>`,
                `<td width="${shareImgColW}" style="width:${shareImgColW}px;vertical-align:top;background:#f3f4f6;padding:0;">`,
                safePhoto
                  ? `<a href="${listingUrl}" style="text-decoration:none;"><img src="${safePhoto}" alt="${address}" width="${shareImgColW}" height="${sharePhotoH}" style="display:block;width:${shareImgColW}px;max-width:100%;height:${sharePhotoH}px;object-fit:cover;object-position:center;border:0;line-height:0;font-size:0;" /></a>`
                  : `<div style="box-sizing:border-box;width:${shareImgColW}px;height:${sharePhotoH}px;line-height:${sharePhotoH}px;text-align:center;background:#f3f4f6;color:#6b7280;font-size:12px;overflow:hidden;">Photo unavailable</div>`,
                `</td>`,
                `<td style="padding:16px 18px;vertical-align:top;">`,
                `<div style="font-size:22px;font-weight:700;color:#111827;line-height:1.2;">${escapeHtml(price)}</div>`,
                `<div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;line-height:1.35;">${address}</div>`,
                `<div style="margin-top:4px;font-size:13px;color:#6b7280;line-height:1.35;">${cityStateZip}</div>`,
                `<div style="margin-top:16px;"><a href="${listingUrl}" style="display:inline-block;background-color:${aacPrimaryCta};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;">View listing</a></div>`,
                `</td>`,
                `</tr>`,
                `</table>`,
              ].join("");
            })
            .join("");

          const plainTextFallback = shareRowsWithListing
            .map((listing) => {
              const listingUrl = `${window.location.origin}/consumer-property/${listing.id}`;
              const price = listing.price ? `$${listing.price.toLocaleString()}` : "Price unavailable";
              const street = formatListingShareEmailStreetLine(listing);
              const cityStateZip = `${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`
                .trim()
                .replace(/^,\s*|,\s*$/g, "");
              const address = [street, cityStateZip].filter(Boolean).join(", ");
              return `- ${address} - ${price} - ${listingUrl}`;
            })
            .join("\n");

          const messageHtml = escapeHtml(shareMessage.trim()).replace(/\n/g, "<br>");
          const aacLogoUrl =
            "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-monogram-green.svg";
          const aacNavy = "#111317";
          const aacGreen = "#50c878";
          const composedMessageHtml = [
            `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;padding:0;background-color:#ffffff;">`,
            `<tr><td align="center" style="padding:24px 12px 32px;">`,
            `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">`,
            `<tr><td align="center" style="background-color:${aacNavy};border-radius:12px 12px 0 0;padding:32px 28px 0;">`,
            `<img src="${aacLogoUrl}" width="40" height="40" alt="All Agent Connect" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />`,
            `<p style="margin:12px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;">All Agent Connect</p>`,
            `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Shared listings</p>`,
            `<div style="width:48px;height:2px;background-color:${aacGreen};margin:16px auto 0;border-radius:1px;"></div>`,
            `<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>`,
            `</td></tr>`,
            `<tr><td style="background-color:#ffffff;border:1px solid #d1d5db;border-top:none;">`,
            `<div style="padding:28px 32px 24px;">`,
            `<div style="font-size:15px;line-height:1.6;color:#334155;">${messageHtml}</div>`,
            `<div style="margin-top:16px;">${listingCardsHtml}</div>`,
            `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#64748b;">`,
            `If a listing is no longer available, your agent can share updated options.`,
            `</p>`,
            `</div>`,
            `</td></tr>`,
            `<tr><td align="center" style="background-color:${aacNavy};border-top:2px solid ${aacGreen};border-radius:0 0 12px 12px;padding:22px 28px 20px;">`,
            `<img src="${aacLogoUrl}" width="24" height="24" alt="" style="display:block;margin:0 auto 10px;border:0;outline:none;" />`,
            `<p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);">All Agent Connect</p>`,
            `<p style="margin:0 0 6px;font-size:12px;">`,
            `<a href="mailto:hello@allagentconnect.com" style="color:rgba(255,255,255,0.45);text-decoration:none;">hello@allagentconnect.com</a>`,
            `</p>`,
            `</td></tr>`,
            `</table>`,
            `<!-- plain-text-fallback: ${escapeHtml(plainTextFallback)} -->`,
            `</td></tr>`,
            `</table>`,
          ].join("");

          const { error } = await supabase.functions.invoke("send-bulk-email", {
            body: {
              recipients: [{ email: recipientEmail, name: recipientName }],
              subject: shareSubject.trim(),
              message: composedMessageHtml,
              agentId: authUser.id,
              sendAsGroup: false,
            },
          });
          if (error) throw error;
          toast.success("Email sent");
          setShareModalOpen(false);
          return;
        }

        const listingCardsHtml = shareRowsWithListing
          .map((listing) => {
            const listingUrl = `${window.location.origin}/property/${listing.id}`;
            const price = listing.price ? `$${listing.price.toLocaleString()}` : "Price unavailable";
            const address = escapeHtml(formatListingShareEmailStreetLine(listing));
            const cityStateZip = escapeHtml(
              `${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`.trim(),
            );
            const photoUrl = getMainPhoto((listing?.photos ?? []) as any[]);
            const safePhoto = photoUrl ? escapeHtml(photoUrl) : "";
            return [
              `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:14px 0;background:#ffffff;box-shadow:0 1px 6px rgba(17,24,39,0.06);">`,
              `<tr>`,
              `<td width="${shareImgColW}" style="width:${shareImgColW}px;vertical-align:top;background:#f3f4f6;padding:0;">`,
              safePhoto
                ? `<a href="${listingUrl}" style="text-decoration:none;"><img src="${safePhoto}" alt="${address}" width="${shareImgColW}" height="${sharePhotoH}" style="display:block;width:${shareImgColW}px;max-width:100%;height:${sharePhotoH}px;object-fit:cover;object-position:center;border:0;line-height:0;font-size:0;" /></a>`
                : `<div style="box-sizing:border-box;width:${shareImgColW}px;height:${sharePhotoH}px;line-height:${sharePhotoH}px;text-align:center;background:#f3f4f6;color:#6b7280;font-size:12px;overflow:hidden;">Photo unavailable</div>`,
              `</td>`,
              `<td style="padding:16px 18px;vertical-align:top;">`,
              `<div style="font-size:22px;font-weight:700;color:#111827;line-height:1.2;">${escapeHtml(price)}</div>`,
              `<div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;line-height:1.35;">${address}</div>`,
              `<div style="margin-top:4px;font-size:13px;color:#6b7280;line-height:1.35;">${cityStateZip}</div>`,
              `<div style="margin-top:16px;"><a href="${listingUrl}" style="display:inline-block;background-color:${aacPrimaryCta};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;">View listing</a></div>`,
              `</td>`,
              `</tr>`,
              `</table>`,
            ].join("");
          })
          .join("");

        const plainTextFallback = shareRowsWithListing
          .map((listing) => {
            const listingUrl = `${window.location.origin}/property/${listing.id}`;
            const price = listing.price ? `$${listing.price.toLocaleString()}` : "Price unavailable";
            const street = formatListingShareEmailStreetLine(listing);
            const cityStateZip = `${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`
              .trim()
              .replace(/^,\s*|,\s*$/g, "");
            const address = [street, cityStateZip].filter(Boolean).join(", ");
            return `- ${address} - ${price} - ${listingUrl}`;
          })
          .join("\n");

        const aacNavy = "#0A1A2F";
        const aacGreen = "#059669";
        const aacLogoUrl = `${window.location.origin}/favicons/aac/favicon-32x32.png`;

        const composedMessageHtml = [
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7fb;padding:18px 0;">`,
          `<tr><td align="center">`,
          `<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">`,
          `<tr><td style="padding:24px 28px 10px;">`,
          `<p style="margin:0;font-size:14px;line-height:1.7;color:#0f172a;white-space:pre-wrap;">${escapeHtml(shareMessage)}</p>`,
          `<div style="margin-top:16px;">${listingCardsHtml}</div>`,
          `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#64748b;">`,
          `If a listing is no longer available, your agent can share updated options.`,
          `</p>`,
          `</td></tr>`,
          `<tr><td align="center" style="background-color:${aacNavy};border-top:2px solid ${aacGreen};border-radius:0 0 12px 12px;padding:22px 28px 20px;">`,
          `<img src="${aacLogoUrl}" width="24" height="24" alt="" style="display:block;margin:0 auto 10px;border:0;outline:none;" />`,
          `<p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);">All Agent Connect</p>`,
          `<p style="margin:0 0 6px;font-size:12px;">`,
          `<a href="mailto:hello@allagentconnect.com" style="color:rgba(255,255,255,0.45);text-decoration:none;">hello@allagentconnect.com</a>`,
          `</p>`,
          `</td></tr>`,
          `</table>`,
          `<!-- plain-text-fallback: ${escapeHtml(plainTextFallback)} -->`,
          `</td></tr>`,
          `</table>`,
        ].join("");

        const { error } = await supabase.functions.invoke("send-bulk-email", {
          body: {
            recipients: [{ email: recipientEmail, name: recipientName }],
            subject: shareSubject.trim(),
            message: composedMessageHtml,
            agentId: authUser.id,
            sendAsGroup: false,
          },
        });
        if (error) throw error;

        toast.success("Email sent");
        setShareModalOpen(false);
      } catch (error: any) {
        console.error("Error sending share email:", error);
        toast.error(error?.message || "Failed to send email");
      } finally {
        setShareSending(false);
      }
    };
    void run();
  }, [shareToEmail, shareSubject, shareMessage, favoritesForShare, buyerMode]);

  const handleDeleteSelected = async () => {
    if (buyerMode) {
      const toRemove = sortedFavoritesWithListing.filter((f) => {
        const lid = normalizeEmbeddedListing(f)?.id;
        return lid != null && sessionKeptListingIds.has(lid);
      });
      if (toRemove.length === 0) return;
      const ids = toRemove.map((f) => f.id);
      const removedListingIds = toRemove.map((f) => f.listings.id);
      try {
        const { error } = await supabase.from("favorites").delete().in("id", ids);
        if (error) throw error;
        setFavorites((prev) => prev.filter((fav) => !ids.includes(fav.id)));
        setSessionKeptListingIds((prev) => {
          const next = new Set(prev);
          removedListingIds.forEach((lid) => next.delete(lid));
          return next;
        });
        setDeleteDialogOpen(false);
        toast.success("Selected favorites removed");
      } catch (error: any) {
        console.error("Error deleting selected favorites:", error);
        toast.error("Failed to remove selected favorites");
      }
      return;
    }
    if (selectedFavoriteIds.size === 0) return;
    try {
      const ids = Array.from(selectedFavoriteIds);
      const { error } = await supabase.from("favorites").delete().in("id", ids);
      if (error) throw error;
      setFavorites((prev) => prev.filter((fav) => !selectedFavoriteIds.has(fav.id)));
      setSelectedFavoriteIds(new Set());
      setDeleteDialogOpen(false);
      toast.success("Selected favorites removed");
    } catch (error: any) {
      console.error("Error deleting selected favorites:", error);
      toast.error("Failed to remove selected favorites");
    }
  };

  const buyerFavoritesPageHeader = (
    <header className="mb-4">
      <AacBackButton
        type="button"
        onClick={() => navigate("/client/dashboard")}
        className="mb-3 max-w-full py-0.5 text-left"
      />
      <div className="border-b border-neutral-200 pb-4">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl">Favorites</h1>
      </div>
    </header>
  );

  const genericFavoritesStickyHeader = (
    <header className="sticky top-14 z-40 border-b border-neutral-200/90 bg-white">
      <div className="mx-auto w-full max-w-[1800px] px-5 md:px-7">
        <AacPageIntro
          withTopPadding
          back={<AacBackButton type="button" onClick={() => navigate("/agent-dashboard")} />}
          title="Favorite listings"
          subtitle="Your account favorites — map, refine, share, or remove selections."
        />
      </div>
    </header>
  )

  if (loading) {
    return (
      <div className={buyerMode ? BUYER_FAVORITES_VIEWPORT : "flex min-h-screen flex-col bg-white"}>
        {!buyerMode ? genericFavoritesStickyHeader : null}
        <main className={buyerMode ? BUYER_FAVORITES_MAIN : "mx-auto w-full max-w-[1800px] flex-1 px-5 py-3 md:px-7"}>
          {buyerMode ? buyerFavoritesPageHeader : null}
          <div className="flex min-h-0 flex-1 flex-col-reverse gap-4 lg:grid lg:grid-cols-[minmax(0,40%)_minmax(0,60%)]">
            <section
              className={`${buyerFavoritesSplitPane} h-[50dvh] min-h-0 sm:h-[54dvh] lg:h-full lg:min-h-0`}
              aria-busy="true"
            >
              <div className="flex h-full flex-col gap-2 p-4">
                <Skeleton className="h-9 w-full max-w-[12rem] rounded-md bg-neutral-100" />
                <Skeleton className="min-h-[12rem] flex-1 rounded-lg bg-neutral-100" />
              </div>
            </section>
            <section className={`${buyerFavoritesSplitPane} flex h-auto min-h-0 max-lg:min-h-[50vh] flex-col lg:min-h-0 lg:h-full`}>
              <div className="shrink-0 border-b border-neutral-200 px-4 py-2.5 sm:px-5">
                <Skeleton className="h-5 w-32 rounded-md bg-neutral-100" />
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-7 w-20 rounded-md bg-neutral-100" />
                  <Skeleton className="h-7 w-24 rounded-md bg-neutral-100" />
                  <Skeleton className="ml-auto h-8 w-[7.5rem] rounded-md bg-neutral-100 sm:ml-0" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2 rounded-xl border border-neutral-200/90 bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                      <Skeleton className="aspect-video w-full rounded-lg bg-neutral-100" />
                      <Skeleton className="h-4 w-[85%] max-w-[14rem] rounded-md bg-neutral-100" />
                      <Skeleton className="h-3 w-full max-w-[10rem] rounded bg-neutral-100" />
                      <Skeleton className="h-3 w-24 rounded bg-neutral-100" />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (buyerMode) {
    return (
      <div className={favorites.length === 0 && !loading ? "flex min-h-0 flex-1 flex-col bg-white" : BUYER_FAVORITES_VIEWPORT}>
        {favorites.length === 0 ? (
          <main className={BUYER_FAVORITES_MAIN}>
            {buyerFavoritesPageHeader}
            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-6">
            <Card className="rounded-2xl border border-neutral-200/90 bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-10">
              <Heart className="mx-auto mb-4 h-12 w-12 text-neutral-300" aria-hidden />
              <h3 className="mb-2 text-base font-semibold tracking-tight text-neutral-900">No saved homes yet</h3>
              <p className="mb-6 text-[13px] leading-snug text-neutral-500">
                Save listings while you browse — they&apos;ll appear here with map pins for quick comparisons.
              </p>
              <Button type="button" size="sm" onClick={() => navigate("/client/search")}>
                Browse listings
              </Button>
            </Card>
            </div>
          </main>
        ) : (
          <main className={BUYER_FAVORITES_MAIN}>
            {buyerFavoritesPageHeader}
            <div className="flex min-h-0 flex-1 flex-col-reverse gap-4 lg:grid lg:grid-cols-[minmax(0,40%)_minmax(0,60%)]">
              <section
                className={`${buyerFavoritesSplitPane} h-[50dvh] min-h-0 sm:h-[54dvh] lg:sticky lg:top-4 lg:h-full lg:min-h-0 lg:self-start`}
              >
                {displayListingRecords.length > 0 ? (
                  <div className="h-full">
                      <PropertyMap
                      listings={propertyMapListings}
                      highlightedListingId={hoveredListingId}
                      selectedListingId={selectedListingId}
                      onListingHover={setHoveredListingId}
                      onListingSelect={handleMarkerSelect}
                      fallbackCenter={BOSTON_DEFAULT_MAP_CENTER}
                      fallbackZoom={11}
                    />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center bg-white px-6 text-center">
                    <MapPin className="mb-3 h-9 w-9 text-neutral-300" aria-hidden />
                    <p className="max-w-sm text-[13px] leading-snug text-neutral-600">
                      No homes in this view have map coordinates yet.
                    </p>
                  </div>
                )}
              </section>

              <section className={`${buyerFavoritesSplitPane} flex h-auto min-h-0 max-lg:min-h-[50vh] flex-col lg:min-h-0 lg:h-full lg:max-h-full`}>
                <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-2.5 sm:px-5">
                  <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                    <p className="text-sm font-semibold tabular-nums text-neutral-900">
                      Results: {displayListingRecords.length.toLocaleString()}
                    </p>
                    <div className="w-full min-w-0 min-[520px]:w-auto min-[520px]:max-w-[11rem]">
                      <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                        <SelectTrigger className="h-8 rounded-md border-neutral-200/90 bg-white text-xs font-medium text-neutral-900 shadow-none focus-visible:ring-2 focus-visible:ring-neutral-300/50 focus-visible:ring-offset-2">
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest</SelectItem>
                          <SelectItem value="price_asc">Price: Low to High</SelectItem>
                          <SelectItem value="price_desc">Price: High to Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 [&_input]:focus-visible:border-neutral-900 [&_input]:focus-visible:ring-1 [&_input]:focus-visible:ring-neutral-300/80 [&_input]:shadow-none [&_textarea]:focus-visible:border-neutral-900 [&_textarea]:focus-visible:ring-1 [&_textarea]:focus-visible:ring-neutral-300/80"
                  aria-label="Saved listings"
                  role="region"
                >
                  {displayFavorites.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        {visibleSelectionState.allVisible && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-md border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
                              onClick={unselectAllVisible}
                            >
                              Unselect all
                            </Button>
                            <BulkShareListingsDialog
                              listingIds={favoriteListingIdsForShare}
                              listingCount={favoriteListingIdsForShare.length}
                              senderProfileSource="buyer"
                              triggerVariant="outline"
                              triggerClassName={buyerFavoritesShareTriggerClass}
                              triggerLabel={`Share selected (${favoriteListingIdsForShare.length})`}
                              onSuccessfulShare={clearShareSelection}
                            />
                          </>
                        )}
                        {visibleSelectionState.someVisible && (
                          <>
                            {!showKeptOnly && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-md border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
                                  onClick={addAllVisible}
                                >
                                  Select all
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-md border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
                                  onClick={() => setShowKeptOnly(true)}
                                >
                                  Keep selected only
                                </Button>
                              </>
                            )}
                            <BulkShareListingsDialog
                              listingIds={favoriteListingIdsForShare}
                              listingCount={favoriteListingIdsForShare.length}
                              senderProfileSource="buyer"
                              triggerVariant="outline"
                              triggerClassName={buyerFavoritesShareTriggerClass}
                              triggerLabel={`Share selected (${favoriteListingIdsForShare.length})`}
                              onSuccessfulShare={clearShareSelection}
                            />
                          </>
                        )}
                        {visibleSelectionState.noneVisible && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-md border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
                            onClick={addAllVisible}
                            disabled={displayListingRecords.length === 0}
                          >
                            Select all
                          </Button>
                        )}
                        {showKeptOnly && (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 rounded-md px-2.5 text-xs font-medium"
                            onClick={() => setShowKeptOnly(false)}
                          >
                            Show all
                          </Button>
                        )}
                        {buyerHasKeptForActions && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-md border-red-200 bg-white px-2.5 text-xs font-medium text-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-red-50"
                            onClick={() => setDeleteDialogOpen(true)}
                          >
                            Remove selected
                          </Button>
                        )}
                    </div>
                  )}

                  {showKeptOnly && displayListingRecords.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200/90 bg-white px-4 py-10 text-center">
                      <p className="text-[13px] text-neutral-600">No homes match your current selection filter.</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 border-neutral-200"
                        size="sm"
                        onClick={() => setShowKeptOnly(false)}
                      >
                        Show all homes
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {displayFavorites.map((favorite) => {
                        const listing = favorite.listings;
                        const isKept = sessionKeptListingIds.has(listing.id);
                        return (
                          <div
                            key={favorite.id}
                            ref={(el) => {
                              cardRefs.current[listing.id] = el;
                            }}
                            onMouseEnter={() => setHoveredListingId(listing.id)}
                            onMouseLeave={() => setHoveredListingId(null)}
                            className="w-full"
                          >
                            <ListingCard
                              listing={listing}
                              viewMode="compact"
                              showActions={false}
                              hideMlsMeta
                              isFavorites
                              onSelect={toggleSessionKeepListing}
                              isSelected={isKept}
                              supplementalAgentProfile={
                                listing.agent_id ? listedByProfileByAgentId.get(listing.agent_id) ?? null : null
                              }
                              showCompactComments={buyerMode && Boolean(favoritesHotSheetForComments)}
                              chatMessages={favoritesChatMap[listing.id] ?? []}
                              onNewMessage={handleFavoritesChatMessage}
                              onOpenChat={
                                buyerMode && favoritesHotSheetForComments
                                  ? () => {
                                      setFavoritesChatListingId(listing.id);
                                      setFavoritesChatOpen(true);
                                    }
                                  : undefined
                              }
                              hotSheetId={favoritesHotSheetForComments ?? undefined}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove selected favorites?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the selected homes from your favorites.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDeleteSelected()}>
                Remove favorites
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {buyerMode && favoritesChatListingId && favoritesConversationAgentUserId ? (
          <ListingConversationSheet
            open={favoritesChatOpen}
            onOpenChange={(open) => {
              setFavoritesChatOpen(open);
              if (!open) setFavoritesChatListingId(null);
            }}
            listingId={favoritesChatListingId}
            otherUserId={favoritesConversationAgentUserId}
            hotSheetId={favoritesDrawerHotSheetId}
            hotSheetAgentUserId={favoritesConversationAgentUserId}
            threadTitle={(() => {
              const fav = favorites.find((f) => f.listings?.id === favoritesChatListingId);
              const l = fav?.listings;
              return l ? `${l.address}, ${l.city}` : "Listing discussion";
            })()}
            onInboxInvalidate={() => {
              void (async () => {
                const { data: auth } = await supabase.auth.getUser();
                const agentId = favoritesConversationAgentUserId;
                if (!auth.user?.id || !agentId || !favoritesChatListingId) return;
                const convoMap = await fetchListingConversationMessagesMap(
                  [favoritesChatListingId],
                  auth.user.id,
                  agentId,
                  agentId,
                );
                setFavoritesChatMap((prev) =>
                  mergeListingThreadMessages(convoMap, {
                    [favoritesChatListingId]: prev[favoritesChatListingId] ?? [],
                  }),
                );
              })();
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {genericFavoritesStickyHeader}

      {favorites.length === 0 ? (
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-10 md:max-w-xl md:px-7">
          <Card className="rounded-2xl border border-neutral-200/90 bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-10">
            <Heart className="mx-auto mb-4 h-12 w-12 text-neutral-300" aria-hidden />
            <h3 className="mb-2 text-base font-semibold tracking-tight text-neutral-900">No favorites yet</h3>
            <p className="mb-6 text-[13px] leading-snug text-neutral-500">
              Save listings while you browse so you can revisit them anytime.
            </p>
            <Button type="button" size="sm" onClick={() => navigate(isPublicMode ? "/" : "/browse")}>
              Browse properties
            </Button>
          </Card>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-[1800px] flex-1 px-5 py-3 md:px-7">
          <div className="flex h-auto min-h-0 flex-col-reverse gap-4 lg:grid lg:h-[calc(100dvh-7.8rem)] lg:min-h-0 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none">
            <section
              className={`${buyerFavoritesSplitPane} h-[50dvh] min-h-0 sm:h-[54dvh] lg:sticky lg:top-[6.05rem] lg:h-full lg:min-h-0`}
            >
              {displayListingRecords.length > 0 ? (
                <div className="h-full">
                  <PropertyMap
                    listings={propertyMapListings}
                    highlightedListingId={hoveredListingId}
                    selectedListingId={selectedListingId}
                    onListingHover={setHoveredListingId}
                    onListingSelect={handleMarkerSelect}
                    fallbackCenter={BOSTON_DEFAULT_MAP_CENTER}
                    fallbackZoom={11}
                  />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-white px-6 text-center">
                  <MapPin className="mb-3 h-9 w-9 text-neutral-300" aria-hidden />
                  <p className="max-w-sm text-[13px] leading-snug text-neutral-600">
                    No pins to show — coordinates may be missing on these listings.
                  </p>
                </div>
              )}
            </section>

            <section className={`${buyerFavoritesSplitPane} flex h-auto min-h-0 max-lg:min-h-[50vh] flex-col lg:h-full`}>
              <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-2.5 sm:px-5">
                <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                  <p className="text-sm font-semibold tabular-nums text-neutral-900">
                    Results: {displayListingRecords.length.toLocaleString()}
                  </p>
                  <div className="w-full min-w-0 min-[520px]:w-auto min-[520px]:max-w-[11rem]">
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                      <SelectTrigger className="h-8 rounded-md border-neutral-200/90 bg-white text-xs font-medium text-neutral-900 shadow-none focus-visible:ring-2 focus-visible:ring-neutral-300/50 focus-visible:ring-offset-2">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="price_asc">Price low to high</SelectItem>
                        <SelectItem value="price_desc">Price high to low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 px-4 py-3 sm:px-5 lg:overflow-y-auto">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-md border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
                    onClick={() =>
                      setSelectedFavoriteIds((prev) =>
                        prev.size === sortedFavoritesWithListing.length
                          ? new Set()
                          : new Set(sortedFavoritesWithListing.map((fav) => fav.id)),
                      )
                    }
                  >
                    {selectedFavoriteIds.size === sortedFavoritesWithListing.length ? "Unselect all" : "Select all"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={favoritesForShare.length === 0}
                    className="h-7 rounded-md border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40"
                    onClick={shareVisibleSelected}
                  >
                    Share selected
                  </Button>
                  {favoritesForShare.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-md border-red-200 bg-white px-2.5 text-xs font-medium text-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-red-50"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      Remove selected
                    </Button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sortedFavoritesWithListing.map((favorite) => {
                    const listing = favorite.listings;
                    const isSelected = selectedFavoriteIds.has(favorite.id);
                    return (
                      <div
                        key={favorite.id}
                        ref={(el) => {
                          cardRefs.current[listing.id] = el;
                        }}
                        onMouseEnter={() => setHoveredListingId(listing.id)}
                        onMouseLeave={() => setHoveredListingId(null)}
                        className="w-full"
                      >
                        <ListingCard
                          listing={listing}
                          viewMode="compact"
                          showActions={false}
                          hideMlsMeta={isPublicMode || isBuyerMode}
                          isFavorites
                          onSelect={() => toggleSelectFavorite(favorite.id)}
                          isSelected={isSelected}
                          supplementalAgentProfile={
                            listing.agent_id ? listedByProfileByAgentId.get(listing.agent_id) ?? null : null
                          }
                          showCompactComments={buyerMode && Boolean(favoritesHotSheetForComments)}
                          chatMessages={favoritesChatMap[listing.id] ?? []}
                          onNewMessage={handleFavoritesChatMessage}
                          onOpenChat={
                            buyerMode && favoritesHotSheetForComments
                              ? () => {
                                  setFavoritesChatListingId(listing.id);
                                  setFavoritesChatOpen(true);
                                }
                              : undefined
                          }
                          hotSheetId={favoritesHotSheetForComments ?? undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </main>
      )}

      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:p-6">
            <h3 className="text-sm font-semibold tracking-tight text-neutral-900">Share selected listings</h3>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="share-to-email-generic" className="text-xs text-neutral-600">
                  To email
                </Label>
                <Input
                  id="share-to-email-generic"
                  type="email"
                  placeholder="name@example.com"
                  value={shareToEmail}
                  onChange={(e) => setShareToEmail(e.target.value)}
                  className="focus-visible:border-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-300/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-subject-generic" className="text-xs text-neutral-600">
                  Subject
                </Label>
                <Input
                  id="share-subject-generic"
                  value={shareSubject}
                  onChange={(e) => setShareSubject(e.target.value)}
                  className="focus-visible:border-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-300/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-message-generic" className="text-xs text-neutral-600">
                  Message
                </Label>
                <Textarea
                  id="share-message-generic"
                  className="min-h-[180px] focus-visible:border-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-300/80"
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-neutral-200"
                onClick={() => setShareModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleSendShareEmail} disabled={shareSending}>
                {shareSending ? "Sending…" : "Send email"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove selected favorites?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected homes from your favorites.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteSelected()}>
              Remove favorites
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {buyerMode && favoritesChatListingId && favoritesConversationAgentUserId ? (
        <ListingConversationSheet
          open={favoritesChatOpen}
          onOpenChange={(open) => {
            setFavoritesChatOpen(open);
            if (!open) setFavoritesChatListingId(null);
          }}
          listingId={favoritesChatListingId}
          otherUserId={favoritesConversationAgentUserId}
          hotSheetId={favoritesDrawerHotSheetId}
          hotSheetAgentUserId={favoritesConversationAgentUserId}
          threadTitle={(() => {
            const fav = favorites.find((f) => f.listings?.id === favoritesChatListingId);
            const l = fav?.listings;
            return l ? `${l.address}, ${l.city}` : "Listing discussion";
          })()}
          onInboxInvalidate={() => {
            void (async () => {
              const { data: auth } = await supabase.auth.getUser();
              const agentId = favoritesConversationAgentUserId;
              if (!auth.user?.id || !agentId || !favoritesChatListingId) return;
              const convoMap = await fetchListingConversationMessagesMap(
                [favoritesChatListingId],
                auth.user.id,
                agentId,
                agentId,
              );
              setFavoritesChatMap((prev) =>
                mergeListingThreadMessages(convoMap, {
                  [favoritesChatListingId]: prev[favoritesChatListingId] ?? [],
                }),
              );
            })();
          }}
        />
      ) : null}

    </div>
  );
};

export default Favorites;
