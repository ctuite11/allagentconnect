import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import ListingCard from "@/components/ListingCard";
import PropertyMap from "@/components/PropertyMap";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, ArrowLeft, MapPin } from "lucide-react";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { buyerFavoritesSplitPane } from "@/lib/buyerUi";

interface Listing {
  id: string;
  listing_number: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  neighborhood?: string | null;
  agent_id: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  property_type: string | null;
  listing_type?: string | null;
  status?: string | null;
  photos: any;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  hot_sheet_id: string;
  hot_sheet_name: string;
}

/** Default map when pins lack coords (matches buyer favorites). */
const BOSTON_DEFAULT_MAP_CENTER = { lat: 42.3601, lng: -71.0589 } as const;

function parseOptionalCoord(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** PropertyMap pins from hot-sheet favorited listings. */
function listingsToMapPins(
  rows: Listing[],
): { id: string; address: string; city: string; state: string; zip_code: string; price: number; latitude: number | null; longitude: number | null }[] {
  return rows.map((rec) => {
    const raw = rec as unknown as Record<string, unknown>;
    const lat =
      parseOptionalCoord(rec.latitude) ?? parseOptionalCoord(raw.lat);
    const lng =
      parseOptionalCoord(rec.longitude) ?? parseOptionalCoord(raw.lng);
    const priceNum = typeof rec.price === "number" && Number.isFinite(rec.price) ? rec.price : Number(rec.price);
    return {
      id: String(rec.id),
      address: rec.address ?? "",
      city: rec.city ?? "",
      state: rec.state ?? "",
      zip_code: rec.zip_code ?? "",
      price: Number.isFinite(priceNum) ? priceNum : 0,
      latitude: lat,
      longitude: lng,
    };
  });
}

const agentHotSheetStickyHeader = (navigate: NavigateFunction) => (
  <header className="sticky top-14 z-40 border-b border-neutral-200/90 bg-white">
    <div className="mx-auto w-full max-w-[1800px] px-5 md:px-7">
      <AacPageIntro
        withTopPadding
        back={<AacBackButton type="button" onClick={() => navigate("/agent-dashboard")} />}
        title="Hot sheet favorites"
        subtitle="Listings you hearted across your hot sheets — map, bulk remove, sort."
      />
    </div>
  </header>
);

function MyFavoritesLoadingShell({ navigate }: { navigate: NavigateFunction }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {agentHotSheetStickyHeader(navigate)}
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-5 py-3 md:px-7">
        <div className="flex h-auto min-h-0 flex-col-reverse gap-4 lg:grid lg:h-[calc(100dvh-7.8rem)] lg:min-h-0 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none">
          <section
            className={`${buyerFavoritesSplitPane} h-[50dvh] min-h-0 sm:h-[54dvh] lg:h-full`}
            aria-busy="true"
          >
            <div className="flex h-full flex-col gap-2 p-4">
              <Skeleton className="h-9 w-full max-w-[12rem] rounded-md bg-neutral-100" />
              <Skeleton className="min-h-[12rem] flex-1 rounded-lg bg-neutral-100" />
            </div>
          </section>
          <section className={`${buyerFavoritesSplitPane} flex h-auto min-h-0 max-lg:min-h-[50vh] flex-col lg:h-full`}>
            <div className="shrink-0 border-b border-neutral-200 px-4 py-2.5 sm:px-5">
              <Skeleton className="h-5 w-32 rounded-md bg-neutral-100" />
            </div>
            <div className="min-h-0 flex-1 space-y-3 p-4 sm:p-5 lg:overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-7 w-28 rounded-md bg-neutral-100" />
                <Skeleton className="h-7 w-24 rounded-md bg-neutral-100" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-xl border border-neutral-200/90 bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                  >
                    <Skeleton className="aspect-video w-full rounded-lg bg-neutral-100" />
                    <Skeleton className="h-4 w-[85%] max-w-[14rem] rounded-md bg-neutral-100" />
                    <Skeleton className="h-3 w-full max-w-[10rem] rounded-md bg-neutral-100" />
                    <Skeleton className="h-3 w-24 rounded-md bg-neutral-100" />
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

const MyFavorites = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [profileByAgentId, setProfileByAgentId] = useState<Map<string, ListedByAgentProfile>>(() => new Map());
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("newest");
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleMarkerSelect = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
    const el = cardRefs.current[listingId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, []);

  useEffect(() => {
    void fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to view favorites");
        navigate("/auth");
        return;
      }

      const { data: hotSheets } = await supabase.from("hot_sheets").select("id, name").eq("user_id", user.id);

      if (!hotSheets?.length) {
        setListings([]);
        return;
      }

      const hotSheetIds = hotSheets.map((hs) => hs.id);

      const { data: statuses, error: statusError } = await supabase
        .from("hot_sheet_listing_status")
        .select("listing_id, hot_sheet_id")
        .in("hot_sheet_id", hotSheetIds)
        .eq("status", "favorited");

      if (statusError) throw statusError;

      if (!statuses?.length) {
        setListings([]);
        return;
      }

      const listingIds = Array.from(new Set(statuses.map((s) => s.listing_id)));

      const { data: listingsData, error: listingsError } = await supabase.from("listings").select("*").in("id", listingIds);

      if (listingsError) throw listingsError;

      const listingsWithHotSheet =
        listingsData?.map((listing) => {
          const status = statuses.find((s) => s.listing_id === listing.id);
          const hotSheet = hotSheets.find((hs) => hs.id === status?.hot_sheet_id);
          return {
            ...listing,
            hot_sheet_id: status?.hot_sheet_id || "",
            hot_sheet_name: hotSheet?.name || "",
          } as Listing;
        }) || [];

      setListings(listingsWithHotSheet);

      const agentIds = Array.from(new Set(listingsData?.map((l: { agent_id?: string }) => l.agent_id).filter(Boolean) as string[]));
      if (agentIds.length > 0) {
        const { data: agents } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, company, office_name")
          .in("id", agentIds);
        const next = new Map<string, ListedByAgentProfile>();
        (agents || []).forEach((a: { id: string; company?: string | null; office_name?: string | null; first_name?: string | null; last_name?: string | null }) => {
          next.set(a.id, {
            company: a.company ?? null,
            office_name: a.office_name ?? null,
            first_name: a.first_name ?? null,
            last_name: a.last_name ?? null,
          });
        });
        setProfileByAgentId(next);
      } else {
        setProfileByAgentId(new Map());
      }
    } catch (error: unknown) {
      console.error("Error fetching favorites:", error);
      toast.error("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const sortedListings = useMemo(() => {
    const next = [...listings];
    switch (sortBy) {
      case "newest":
        return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "oldest":
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case "price-high":
        return next.sort((a, b) => b.price - a.price);
      case "price-low":
        return next.sort((a, b) => a.price - b.price);
      default:
        return next;
    }
  }, [listings, sortBy]);

  const mapPins = useMemo(() => listingsToMapPins(sortedListings), [sortedListings]);

  useEffect(() => {
    if (!selectedListingId) return;
    if (!sortedListings.some((l) => l.id === selectedListingId)) setSelectedListingId(null);
  }, [sortedListings, selectedListingId]);

  const toggleListing = (listingId: string) => {
    setSelectedListings((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedListings.size === listings.length && listings.length > 0) {
      setSelectedListings(new Set());
    } else {
      setSelectedListings(new Set(listings.map((l) => l.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedListings.size === 0) {
      toast.error("Please select listings to delete");
      return;
    }

    try {
      const updates = Array.from(selectedListings).map((listingId) => {
        const listing = listings.find((l) => l.id === listingId);
        return {
          hot_sheet_id: listing?.hot_sheet_id,
          listing_id: listingId,
          status: "deleted" as const,
        };
      });

      for (const update of updates) {
        const { error } = await supabase.from("hot_sheet_listing_status").upsert({
          hot_sheet_id: update.hot_sheet_id,
          listing_id: update.listing_id,
          status: update.status,
        });

        if (error) throw error;
      }

      toast.success(`Removed ${selectedListings.size} from favorites`);
      setSelectedListings(new Set());
      void fetchFavorites();
    } catch (error: unknown) {
      console.error("Error deleting listings:", error);
      toast.error("Failed to remove selections");
    }
  };

  if (loading) {
    return <MyFavoritesLoadingShell navigate={navigate} />;
  }

  const mapRenderableCount = mapPins.filter(
    (p) => parseOptionalCoord(p.latitude) != null && parseOptionalCoord(p.longitude) != null,
  ).length;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {agentHotSheetStickyHeader(navigate)}

      {listings.length === 0 ? (
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-10 md:max-w-xl md:px-7">
          <Card className="rounded-2xl border border-neutral-200/90 bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-10">
            <Heart className="mx-auto mb-4 h-12 w-12 text-neutral-300" aria-hidden />
            <h3 className="mb-2 text-base font-semibold tracking-tight text-neutral-900">No hot sheet favorites yet</h3>
            <p className="mb-6 text-[13px] leading-snug text-neutral-500">
              Heart listings from any hot sheet — they aggregate here automatically.
            </p>
            <Button type="button" size="sm" onClick={() => navigate("/agent/hot-sheets")}>
              Open hot sheets
            </Button>
          </Card>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-[1800px] flex-1 px-5 py-3 md:px-7">
          <div className="flex h-auto min-h-0 flex-col-reverse gap-4 lg:grid lg:h-[calc(100dvh-7.8rem)] lg:min-h-0 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none">
            <section
              className={`${buyerFavoritesSplitPane} h-[50dvh] min-h-0 sm:h-[54dvh] lg:sticky lg:top-[6.05rem] lg:h-full lg:min-h-0`}
            >
              {mapRenderableCount > 0 ? (
                <div className="h-full">
                  <PropertyMap
                    listings={mapPins}
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
                    No map pins yet — favorites need latitude and longitude on the listing record.
                  </p>
                </div>
              )}
            </section>

            <section className={`${buyerFavoritesSplitPane} flex h-auto min-h-0 max-lg:min-h-[50vh] flex-col lg:h-full`}>
              <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-2.5 sm:px-5">
                <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                  <p className="text-sm font-semibold tabular-nums text-neutral-900">
                    Results: {sortedListings.length.toLocaleString()}
                  </p>
                  <div className="w-full min-w-0 min-[520px]:w-auto min-[520px]:max-w-[13rem]">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-8 rounded-md border-neutral-200/90 bg-white text-xs font-medium text-neutral-900 shadow-none focus-visible:ring-2 focus-visible:ring-neutral-300/50 focus-visible:ring-offset-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest to oldest</SelectItem>
                        <SelectItem value="oldest">Oldest to newest</SelectItem>
                        <SelectItem value="price-high">Price: High to low</SelectItem>
                        <SelectItem value="price-low">Price: Low to high</SelectItem>
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
                    onClick={toggleSelectAll}
                  >
                    {selectedListings.size === listings.length && listings.length > 0 ? "Unselect all" : "Select all"}
                  </Button>
                  <span className="text-[13px] text-neutral-500">
                    {selectedListings.size > 0 ? `${selectedListings.size} selected` : null}
                  </span>
                  {selectedListings.size > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-md border-red-200 bg-white px-2.5 text-xs font-medium text-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-red-50"
                      onClick={handleBulkDelete}
                    >
                      Remove selected
                    </Button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sortedListings.map((listing) => {
                  const supplemental = listing.agent_id ? profileByAgentId.get(listing.agent_id) ?? null : null;
                  return (
                    <div
                      key={listing.id}
                      ref={(el) => {
                        cardRefs.current[listing.id] = el;
                      }}
                      onMouseEnter={() => setHoveredListingId(listing.id)}
                      onMouseLeave={() => setHoveredListingId(null)}
                      className="w-full"
                    >
                      <ListingCard
                        listing={{
                          id: listing.id,
                          address: listing.address,
                          city: listing.city,
                          state: listing.state,
                          zip_code: listing.zip_code,
                          price: listing.price,
                          property_type: listing.property_type ?? null,
                          bedrooms: listing.bedrooms,
                          bathrooms: listing.bathrooms,
                          square_feet: listing.square_feet,
                          status: listing.status ?? "active",
                          listing_type: listing.listing_type ?? null,
                          photos: listing.photos,
                          agent_id: listing.agent_id,
                          neighborhood: listing.neighborhood ?? null,
                          listing_number: listing.listing_number ?? null,
                          created_at: listing.created_at,
                        }}
                        viewMode="compact"
                        showActions={false}
                        hideMlsMeta
                        isFavorites
                        supplementalAgentProfile={supplemental}
                        clientComment={listing.hot_sheet_name ? `Saved on · ${listing.hot_sheet_name}` : undefined}
                        onSelect={toggleListing}
                        isSelected={selectedListings.has(listing.id)}
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
    </div>
  );
};

export default MyFavorites;
