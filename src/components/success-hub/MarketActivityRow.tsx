import { useEffect, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bed, Bath, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleListings } from "@/lib/filterVisibleListings";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

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

function formatPrice(price: number | null) {
  if (price == null) return "—";
  return `$${price.toLocaleString()}`;
}

function isNew(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 48 * 60 * 60 * 1000;
}

const PREVIEW_IMAGE_H = "h-40";

export function MarketActivityRow() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  const topListings = useMemo(() => listings.slice(0, 3), [listings]);

  const gridClass = useMemo(() => {
    const n = topListings.length;
    if (n === 0) return "";
    if (n === 1) return "grid grid-cols-1 gap-4";
    if (n === 2) return "grid grid-cols-1 gap-4 sm:grid-cols-2";
    return "grid grid-cols-1 gap-4 sm:grid-cols-3";
  }, [topListings.length]);

  const headerBlock = (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-neutral-900">Market activity</h3>
        <p className="mt-0.5 max-w-lg text-[13px] leading-snug text-neutral-500">
          Recent listings across AAC — open any card for full details.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate("/browse")}
        className="shrink-0 text-sm font-medium text-[#0E56F5] hover:underline"
      >
        Browse homes
      </button>
    </div>
  );

  if (loading) {
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-neutral-900">Market activity</h3>
            <p className="mt-0.5 text-[13px] text-neutral-500">Loading recent listings…</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-zinc-100 bg-white h-[220px]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="max-w-xl">
        {headerBlock}
        <div className="rounded-2xl border border-dashed border-zinc-100 bg-white px-4 py-5 text-center shadow-none">
          <p className="text-sm text-neutral-600">No new market activity yet.</p>
          <button
            type="button"
            onClick={() => navigate("/browse")}
            className="mt-2 text-sm font-medium text-[#0E56F5] hover:underline"
          >
            Browse homes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {headerBlock}

      <div className={cn(gridClass, topListings.length === 1 && "max-w-[320px]")}>
        {topListings.map((listing) => {
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
              className="flex min-w-0 w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-none transition-colors duration-150 hover:border-zinc-200"
            >
              {/* Photo */}
              <div
                className={cn(
                  "relative w-full shrink-0 overflow-hidden rounded-t-2xl border-b border-zinc-100 bg-white",
                  PREVIEW_IMAGE_H,
                )}
              >
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
              <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-3">
                <p className="text-base font-bold leading-tight text-[#0E56F5]">
                  {formatPrice(listing.price)}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-neutral-900">
                  {listing.address}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {listing.city}, {listing.state}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-2 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-0.5">
                    <Bed className="h-3 w-3 shrink-0 text-[#0E56F5]" /> {listing.bedrooms}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Bath className="h-3 w-3 shrink-0 text-[#0E56F5]" /> {listing.bathrooms}
                  </span>
                  {listing.square_feet ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Square className="h-3 w-3 shrink-0 text-[#0E56F5]" /> {listing.square_feet.toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[11px] text-neutral-400">{listing.brokerage}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
