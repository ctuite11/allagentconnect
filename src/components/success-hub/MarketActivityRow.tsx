import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Bed, Bath, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleListings } from "@/lib/filterVisibleListings";

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
        <h3 className="text-lg font-semibold text-foreground mb-3">Market Activity</h3>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[220px] h-[220px] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Market Activity</h3>
        <div className="rounded-xl border border-border bg-card px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">No new market activity yet</p>
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
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="p-1 rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="p-1 rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
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
              onClick={() => navigate(`/property/${listing.id}`)}
              className="min-w-[220px] max-w-[240px] flex-shrink-0 rounded-xl border border-border bg-card cursor-pointer hover:shadow-lg hover:-translate-y-[1px] transition-all duration-200"
            >
              {/* Photo */}
              <div className="relative rounded-t-xl overflow-hidden aspect-[4/3] bg-muted">
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
                {isNew(listing.created_at) && (
                  <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    New
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="px-3 pt-2 pb-3">
                <p className="text-base font-bold text-primary">
                  {formatPrice(listing.price)}
                </p>
                <p className="text-sm font-medium text-foreground truncate mt-0.5">
                  {listing.address}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {listing.city}, {listing.state}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    <Bed className="h-3 w-3 text-primary" /> {listing.bedrooms}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Bath className="h-3 w-3 text-primary" /> {listing.bathrooms}
                  </span>
                  {listing.square_feet && (
                    <span className="inline-flex items-center gap-0.5">
                      <Square className="h-3 w-3 text-primary" /> {listing.square_feet.toLocaleString()}
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
