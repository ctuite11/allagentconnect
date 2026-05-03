import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bed, Bath, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleListings } from "@/lib/filterVisibleListings";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import {
  SUCCESS_HUB_CARD_IMG,
  SUCCESS_HUB_LISTING_GRID,
} from "@/components/success-hub/successHubListingCardStyles";

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

const DISPLAY_CAP = 24;

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
      .limit(42);

    if (error || !data) {
      setLoading(false);
      return;
    }

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
    const visible = filterVisibleListings(parsed, userId).slice(0, DISPLAY_CAP);
    setListings(visible);
    setLoading(false);
  }, [parseListing]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    const channel = supabase
      .channel("market-activity-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "listings" },
        async (payload) => {
          const newRow = payload.new as any;
          if (!newRow || newRow.status === "draft" || newRow.status === "expired") return;

          const { data } = await supabase
            .from("listings")
            .select(`
              id, address, city, state, price, bedrooms, bathrooms, square_feet,
              photos, status, created_at, agent_id
            `)
            .eq("id", newRow.id)
            .maybeSingle();

          if (!data) return;

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

          setListings((prev) => [visible[0], ...prev].slice(0, DISPLAY_CAP));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, parseListing]);

  const headerBlock = (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-neutral-900">Market activity</h3>
        <p className="mt-0.5 max-w-lg text-[13px] leading-snug text-neutral-500">
          Recent listings across AAC — tap a card for details.
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
        <div className={SUCCESS_HUB_LISTING_GRID}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[220px] animate-pulse rounded-2xl border border-zinc-100 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="min-w-0">
        {headerBlock}
        <div className="rounded-xl border border-dashed border-zinc-100 bg-white px-4 py-4 text-center">
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

      <div className={SUCCESS_HUB_LISTING_GRID}>
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
              className="flex min-w-0 w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-none transition-colors duration-150 hover:border-zinc-200"
            >
              <div
                className={cn(
                  "relative rounded-t-2xl border-b border-zinc-100 bg-white",
                  SUCCESS_HUB_CARD_IMG,
                )}
              >
                {photo ? (
                  <img
                    src={photo}
                    alt={listing.address}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                    No photo
                  </div>
                )}
                <div className="absolute left-2 top-2">
                  <ListingStatusBadge status={listing.status} size="sm" />
                </div>
                {isNew(listing.created_at) && (
                  <span className="absolute right-2 top-2 rounded-full bg-[#50C878] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    New
                  </span>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-3 pb-2.5 pt-2">
                <p className="text-base font-semibold leading-tight tracking-tight text-[#0E56F5]">
                  {formatPrice(listing.price)}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-neutral-900">
                  {listing.address}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {listing.city}, {listing.state}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-zinc-100 pt-2 text-[11px] text-neutral-600">
                  <span className="inline-flex items-center gap-0.5">
                    <Bed className="h-3 w-3 shrink-0 text-[#0E56F5]" /> {listing.bedrooms}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Bath className="h-3 w-3 shrink-0 text-[#0E56F5]" /> {listing.bathrooms}
                  </span>
                  {listing.square_feet ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Square className="h-3 w-3 shrink-0 text-[#0E56F5]" />{" "}
                      {listing.square_feet.toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[10px] text-neutral-400">{listing.brokerage}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
