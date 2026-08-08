import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleListings } from "@/lib/filterVisibleListings";
import { mapMarketRowToListingCard } from "@/components/success-hub/listingCardAdapter";
import { SuccessHubListingCard } from "@/components/success-hub/SuccessHubListingCard";
import { SUCCESS_HUB_LISTINGS_GRID } from "@/components/success-hub/successHubListingLayout";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";

/** Matches listing-search compact share trigger (neutral AAC). */
const MARKET_ACTIVITY_SHARE_TRIGGER =
  "h-7 gap-0 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/90 disabled:pointer-events-none disabled:opacity-40 [&_svg]:mr-1 [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:text-neutral-600";

interface MarketListingRow {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  listing_type: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: unknown;
  status: string;
  created_at: string;
  updated_at: string;
  active_date: string | null;
  listing_number: string | null;
  agent_id: string;
  brokerage: string;
  neighborhood: string | null;
  unit_number: string | null;
  condo_details: unknown;
  agent_email?: string;
  listing_agent_name?: string;
}

type AgentListingMeta = {
  company: string;
  name: string;
  email: string;
};

/** Pool size from Supabase before visibility filter. */
const FETCH_LISTING_LIMIT = 42;
/** Fixed number of cards shown; new realtime items displace the oldest slot (no extra rows from updates). */
const VISIBLE_MARKET_ACTIVITY_SLOTS = 4;

type MarketTypeFilter = "sale" | "rental";

export function MarketActivityRow() {
  const navigate = useNavigate();
  const [poolListings, setPoolListings] = useState<MarketListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [marketTypeFilter, setMarketTypeFilter] = useState<MarketTypeFilter>("sale");

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedListingIds = Array.from(selectedIds);
  const selectedCount = selectedListingIds.length;

  const parseListing = useCallback((row: any, agentMeta: Record<string, AgentListingMeta>): MarketListingRow => {
    const meta = agentMeta[row.agent_id];
    return {
      id: row.id,
      address: row.address,
      city: row.city,
      state: row.state,
      zip_code: typeof row.zip_code === "string" ? row.zip_code : "",
      price: row.price,
      price_range_min: typeof row.price_range_min === "number" ? row.price_range_min : null,
      price_range_max: typeof row.price_range_max === "number" ? row.price_range_max : null,
      listing_type: row.listing_type ?? null,
      property_type: row.property_type ?? null,
      bedrooms: typeof row.bedrooms === "number" ? row.bedrooms : null,
      bathrooms: typeof row.bathrooms === "number" ? row.bathrooms : null,
      square_feet: typeof row.square_feet === "number" ? row.square_feet : null,
      photos: row.photos,
      status: row.status,
      created_at: row.created_at,
      updated_at: typeof row.updated_at === "string" ? row.updated_at : row.created_at,
      active_date: typeof row.active_date === "string" ? row.active_date : null,
      listing_number: typeof row.listing_number === "string" ? row.listing_number : null,
      agent_id: row.agent_id,
      brokerage: meta?.company || "AAC Agent",
      agent_email: meta?.email || undefined,
      listing_agent_name: meta?.name || undefined,
      neighborhood: typeof row.neighborhood === "string" ? row.neighborhood : null,
      unit_number:
        row.unit_number != null && String(row.unit_number).trim() !== ""
          ? String(row.unit_number).trim()
          : null,
      condo_details: row.condo_details ?? null,
    };
  }, []);

  const fetchListings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    setCurrentUserId(userId);

    const { data, error } = await supabase
      .from("listings")
      .select(`
        id, address, city, state, zip_code, price, price_range_min, price_range_max, listing_type,
        property_type,
        bedrooms, bathrooms, square_feet, neighborhood,
        photos, status, created_at, updated_at, active_date, listing_number, unit_number, condo_details,
        agent_id
      `)
      .not("status", "in", "(draft,expired)")
      .eq("hidden_from_market_activity", false)
      .order("updated_at", { ascending: false })
      .limit(FETCH_LISTING_LIMIT);

    if (error || !data) {
      setLoading(false);
      return;
    }

    const agentIds = [...new Set(data.map((r: any) => r.agent_id))];
    const agentMeta: Record<string, AgentListingMeta> = {};
    if (agentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("agent_profiles")
        .select("id, company, first_name, last_name, email")
        .in("id", agentIds);
      if (profiles) {
        for (const p of profiles) {
          const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
          agentMeta[p.id] = {
            company: (typeof p.company === "string" && p.company.trim()) || "AAC Agent",
            name: name || "Listing agent",
            email: typeof p.email === "string" ? p.email.trim() : "",
          };
        }
      }
    }

    const parsed = data.map((row: any) => parseListing(row, agentMeta));
    const visible = filterVisibleListings(parsed, userId);
    setPoolListings(visible);
    setLoading(false);
  }, [parseListing]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const visibleListings = useMemo(() => {
    const sorted = [...poolListings].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    const filtered =
      marketTypeFilter === "sale"
        ? sorted.filter((l) => l.listing_type === "for_sale")
        : sorted.filter((l) => l.listing_type === "for_rent");
    return filtered.slice(0, VISIBLE_MARKET_ACTIVITY_SLOTS);
  }, [poolListings, marketTypeFilter]);

  useEffect(() => {
    const allowed = new Set(visibleListings.map((l) => l.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => allowed.has(id)));
      if (prev.size === next.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [visibleListings]);

  useEffect(() => {
    const upsertFromListingChange = async (listingId: string) => {
      const { data } = await supabase
        .from("listings")
        .select(`
          id, address, city, state, zip_code, price, price_range_min, price_range_max, listing_type,
          property_type,
          bedrooms, bathrooms, square_feet, neighborhood,
          photos, status, created_at, updated_at, active_date, listing_number, unit_number, condo_details,
          agent_id
        `)
        .eq("id", listingId)
        .maybeSingle();

      if (!data) return;
      if ((data as any).hidden_from_market_activity === true) {
        setPoolListings((prev) => prev.filter((l) => l.id !== data.id));
        return;
      }

      const agentMeta: Record<string, AgentListingMeta> = {};
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("id, company, first_name, last_name, email")
        .eq("id", data.agent_id)
        .maybeSingle();
      if (profile) {
        const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
        agentMeta[profile.id] = {
          company:
            (typeof profile.company === "string" && profile.company.trim()) || "AAC Agent",
          name: name || "Listing agent",
          email: typeof profile.email === "string" ? profile.email.trim() : "",
        };
      }

      const parsed = parseListing(data, agentMeta);
      const visible = filterVisibleListings([parsed], currentUserId);

      setPoolListings((prev) => {
        // Remove if not visible to this user (e.g., off_market not owned)
        if (visible.length === 0) return prev.filter((l) => l.id !== parsed.id);

        const without = prev.filter((l) => l.id !== parsed.id);
        const next = [parsed, ...without].sort(
          (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
        );
        return next.slice(0, FETCH_LISTING_LIMIT);
      });
    };

    const channel = supabase
      .channel("market-activity-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "listings" },
        async (payload) => {
          const newRow = payload.new as any;
          if (!newRow || newRow.status === "draft" || newRow.status === "expired") return;
          if (newRow.hidden_from_market_activity === true) return;
          if (typeof newRow.id !== "string") return;
          await upsertFromListingChange(newRow.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "listings" },
        async (payload) => {
          const oldRow = payload.old as any;
          const newRow = payload.new as any;
          if (!newRow || newRow.status === "draft" || newRow.status === "expired") return;
          if (typeof newRow.id !== "string") return;
          if (newRow.hidden_from_market_activity === true) {
            setPoolListings((prev) => prev.filter((l) => l.id !== newRow.id));
            return;
          }

          // Avoid re-fetching on unrelated updates; treat only status/type/price changes as meaningful.
          const relevantChanged = ["status", "listing_type", "price", "price_range_min", "price_range_max", "active_date"].some(
            (k) => oldRow?.[k] !== newRow?.[k],
          );
          if (!relevantChanged) return;

          await upsertFromListingChange(newRow.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, parseListing]);

  const headerBlock = (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-neutral-900">
          <LineChart className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />
          Listing Activity
        </h3>
        <p className="mt-0.5 max-w-lg text-xs leading-snug text-neutral-500">
          Newest and pre-market listings across AAC — tap a card for details.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate("/browse")}
        className="shrink-0 rounded-sm text-sm font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
      >
        Search
      </button>
    </div>
  );

  if (loading) {
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-neutral-900">
              <LineChart className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              Listing Activity
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">Loading recent listings…</p>
          </div>
        </div>
        <div className={SUCCESS_HUB_LISTINGS_GRID}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="min-w-0 h-[17.5rem] max-w-full animate-pulse rounded-lg border border-zinc-100 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  if (visibleListings.length === 0) {
    return (
      <div className="min-w-0">
        {headerBlock}
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-4 text-center">
          <p className="text-sm text-neutral-600">No new market activity yet.</p>
          <button
            type="button"
            onClick={() => navigate("/browse")}
            className="mt-2 rounded-sm text-sm font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
          >
            Search listings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {headerBlock}

      <div
        className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        role="toolbar"
        aria-label="Market activity selection"
      >
        <BulkShareListingsDialog
          listingIds={selectedListingIds}
          listingCount={selectedCount}
          triggerVariant="outline"
          triggerClassName={MARKET_ACTIVITY_SHARE_TRIGGER}
          triggerLabel="Share selected"
          onSuccessfulShare={clearSelection}
        />

        <div className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            onClick={() => setMarketTypeFilter("sale")}
            className={[
              "h-7 whitespace-nowrap rounded-sm px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2",
              marketTypeFilter === "sale"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-800 hover:bg-neutral-50",
            ].join(" ")}
          >
            Sale
          </button>
          <button
            type="button"
            onClick={() => setMarketTypeFilter("rental")}
            className={[
              "h-7 whitespace-nowrap rounded-sm px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2",
              marketTypeFilter === "rental"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-800 hover:bg-neutral-50",
            ].join(" ")}
          >
            Rental
          </button>
        </div>

        {selectedCount > 0 ? (
          <button
            type="button"
            className="h-7 shrink-0 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-neutral-300 hover:bg-neutral-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
            onClick={clearSelection}
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* Same responsive grid as My listings — cards shrink to the section width (no forced horizontal scroll). */}
      <div className={SUCCESS_HUB_LISTINGS_GRID}>
        {visibleListings.map((listing) => (
          <div key={listing.id} className="min-w-0">
            <SuccessHubListingCard
              listing={mapMarketRowToListingCard(listing)}
              compactSelectionAccent="aacGreen"
              onSelect={(id) => toggleSelection(id)}
              isSelected={selectedIds.has(listing.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
