import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Bed, Bath, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleListings } from "@/lib/filterVisibleListings";
import { ListingStatusBadge } from "@/components/ui/status-badge";

interface MarketListing {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number | null;
  bedrooms: number;
  bathrooms: number;
  square_feet: number | null;
  photos: any;
  status: string;
  created_at: string;
  agent_id: string;
  brokerage: string;
}

type ListingRow = Omit<MarketListing, "brokerage">;

function formatPrice(price: number | null) {
  if (price == null) return "—";
  return `$${price.toLocaleString()}`;
}

function isNew(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 48 * 60 * 60 * 1000;
}

export function MarketActivityRow() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
    setTimeout(updateScrollState, 350);
  };

  const parseListing = useCallback((row: any, companyMap: Record<string, string>): MarketListing => {
    return {
      id: row.id,
      address: row.address,
      city: row.city,
      state: row.state,
      price: row.price,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      square_feet: row.square_feet,
      photos: row.photos,
      status: row.status,
      created_at: row.created_at,
      agent_id: row.agent_id,
      brokerage: companyMap[row.agent_id] || "AAC Agent",
    };
  }, []);

  const fetchListings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    setCurrentUserId(userId);

    const { data, error } = await supabase
      .from("listings")
      .select(`
        id, address, city, state, price, bedrooms, bathrooms, square_feet,
        photos, status, created_at, agent_id
      `)
      .not("status", "in", "(draft,expired)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data) {
      setLoading(false);
      return;
    }

    // Fetch brokerage names for the agent_ids
    const agentIds = [...new Set(data.map((r: any) => r.agent_id))];
    const companyMap: Record<string, string> = {};
    if (agentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("agent_profiles")
        .select("id, company")
        .in("id", agentIds);
      if (profiles) {
        for (const p of profiles) {
          if (p.company) companyMap[p.id] = p.company;
        }
      }
    }

    const parsed = data.map((row: any) => parseListing(row, companyMap));
    const visible = filterVisibleListings(parsed, userId).slice(0, 10);
    setListings(visible);
    setLoading(false);
  }, [parseListing]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Realtime subscription for new listings
  useEffect(() => {
    const channel = supabase
      .channel("market-activity-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "listings" },
        async (payload) => {
          const newRow = payload.new as any;
          if (!newRow || newRow.status === "draft" || newRow.status === "expired") return;

          // Fetch full row
          const { data } = await supabase
            .from("listings")
            .select(`
              id, address, city, state, price, bedrooms, bathrooms, square_feet,
              photos, status, created_at, agent_id
            `)
            .eq("id", newRow.id)
            .maybeSingle();

          if (!data) return;

          // Fetch brokerage
          const companyMap: Record<string, string> = {};
          const { data: profile } = await supabase
            .from("agent_profiles")
            .select("id, company")
            .eq("id", data.agent_id)
            .maybeSingle();
          if (profile?.company) companyMap[profile.id] = profile.company;

          const parsed = parseListing(data, companyMap);
          const visible = filterVisibleListings([parsed], currentUserId);
          if (visible.length === 0) return;

          setListings((prev) => [visible[0], ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, parseListing]);

  if (loading) {
    return (
      <div>
        <h3 className="mb-4 text-[15px] font-semibold text-neutral-900">Market activity</h3>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[232px] min-w-[236px] animate-pulse rounded-2xl border border-zinc-100 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div>
        <h3 className="mb-4 text-[15px] font-semibold text-neutral-900">Market activity</h3>
        <div className="rounded-2xl border border-dashed border-zinc-100 bg-white px-6 py-10 text-center shadow-none">
          <p className="text-sm text-neutral-500">No new market activity yet</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">Market Activity</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="rounded-full border border-zinc-100 p-1 transition-colors hover:border-zinc-200 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="rounded-full border border-zinc-100 p-1 transition-colors hover:border-zinc-200 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1"
      >
        {listings.map((listing) => {
          const raw = listing.photos?.[0];
          const photo = typeof raw === "string" ? raw : raw?.url ?? null;

          return (
            <div
              key={listing.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/property/${listing.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/property/${listing.id}`);
                }
              }}
              className="min-w-[236px] max-w-[248px] flex-shrink-0 cursor-pointer rounded-2xl border border-zinc-100 bg-white shadow-none transition-colors duration-150 hover:border-zinc-200"
            >
              {/* Photo */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl border-b border-zinc-100 bg-white">
                {photo ? (
                  <img
                    src={photo}
                    alt={listing.address}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    No photo
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <ListingStatusBadge status={listing.status} size="sm" />
                </div>
                {isNew(listing.created_at) && (
                  <span className="absolute top-2 right-2 rounded-full bg-[#50C878] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    New
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="px-3 pt-2 pb-3">
                <p className="text-base font-bold text-[#0E56F5]">
                  {formatPrice(listing.price)}
                </p>
                <p className="text-sm font-medium text-foreground truncate mt-0.5">
                  {listing.address}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {listing.city}, {listing.state}
                </p>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-0.5">
                    <Bed className="h-3 w-3 text-[#0E56F5]" /> {listing.bedrooms}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Bath className="h-3 w-3 text-[#0E56F5]" /> {listing.bathrooms}
                  </span>
                  {listing.square_feet && (
                    <span className="inline-flex items-center gap-0.5">
                      <Square className="h-3 w-3 text-[#0E56F5]" /> {listing.square_feet.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                  {listing.brokerage}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
