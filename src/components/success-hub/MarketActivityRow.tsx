import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/ListingCard";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleListings } from "@/lib/filterVisibleListings";
import { mapMarketRowToListingCard } from "@/components/success-hub/listingCardAdapter";

interface MarketListingRow {
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
  photos: unknown;
  status: string;
  created_at: string;
  agent_id: string;
  brokerage: string;
}

const DISPLAY_CAP = 24;

/** Compact cards: match Browse grid image band (ListingCard compact uses h-48; Success Hub targets h-40). */
const LISTING_CARD_GRID =
  "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&_img]:!h-40";

export function MarketActivityRow() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<MarketListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const parseListing = useCallback((row: any, companyMap: Record<string, string>): MarketListingRow => {
    return {
      id: row.id,
      address: row.address,
      city: row.city,
      state: row.state,
      zip_code: typeof row.zip_code === "string" ? row.zip_code : "",
      price: row.price,
      property_type: row.property_type ?? null,
      bedrooms: typeof row.bedrooms === "number" ? row.bedrooms : null,
      bathrooms: typeof row.bathrooms === "number" ? row.bathrooms : null,
      square_feet: typeof row.square_feet === "number" ? row.square_feet : null,
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
        id, address, city, state, zip_code, price, property_type,
        bedrooms, bathrooms, square_feet,
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
              id, address, city, state, zip_code, price, property_type,
              bedrooms, bathrooms, square_feet,
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
        View all →
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
        <div className={LISTING_CARD_GRID}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-zinc-100 bg-white" />
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
            View all →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {headerBlock}

      <div className={LISTING_CARD_GRID}>
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={mapMarketRowToListingCard(listing)}
            viewMode="compact"
            showActions={false}
            hideMlsMeta={true}
            agentInfo={listing.brokerage ? { name: listing.brokerage, company: null } : undefined}
          />
        ))}
      </div>
    </div>
  );
}
