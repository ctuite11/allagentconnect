import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AgentSplitResultsSurface } from "@/components/listing-search/AgentSplitResultsSurface";
import { SuccessHubListingCard } from "@/components/success-hub/SuccessHubListingCard";
import {
  mapAgentClientFavoriteRpcToListingCard,
  type AgentClientFavoriteRpcRow,
  type ListingCardModel,
} from "@/components/success-hub/listingCardAdapter";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { listingRowForAgentSplitMapCompact, type AgentSplitListing } from "@/lib/agentSplitResults";
import { removeBuyerFavoriteForAgent } from "@/lib/removeBuyerFavoriteForAgent";

function titleCaseToken(term: string): string {
  const t = term.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function formatFavoritesClientDisplayName(first: string, last: string): string {
  const fnParts = first.trim().split(/\s+/).filter(Boolean).map(titleCaseToken);
  const lnParts = last.trim().split(/\s+/).filter(Boolean).map(titleCaseToken);
  return [...fnParts, ...lnParts].filter(Boolean).join(" ").trim();
}

async function fetchListingEnrichmentForFavorites(
  listingIds: string[],
): Promise<Record<string, Partial<ListingCardModel>>> {
  if (listingIds.length === 0) return {};
  const { data: rows, error } = await supabase
    .from("listings")
    .select(
      "id, listing_number, zip_code, square_feet, property_type, created_at, status, agent_id, latitude, longitude, list_date, unit_number, neighborhood, listing_type, price_range_min, price_range_max",
    )
    .in("id", listingIds);
  if (error || !rows?.length) return {};

  const agentIds = [...new Set(rows.map((r) => String((r as { agent_id?: string }).agent_id ?? "")).filter(Boolean))];
  let agents: {
    id: string;
    first_name: string;
    last_name: string;
    company: string | null;
    office_name: string | null;
  }[] = [];
  if (agentIds.length > 0) {
    const { data: ap } = await supabase
      .from("agent_profiles")
      .select("id, first_name, last_name, company, office_name")
      .in("id", agentIds);
    agents = (ap ?? []) as typeof agents;
  }
  const byAgent = new Map(agents.map((a) => [a.id, a]));
  const out: Record<string, Partial<ListingCardModel>> = {};
  for (const row of rows as {
    id: string;
    listing_number?: string | null;
    zip_code?: string | null;
    square_feet?: number | null;
    property_type?: string | null;
    created_at?: string;
    status?: string;
    agent_id?: string;
    latitude?: number | null;
    longitude?: number | null;
    list_date?: string | null;
    unit_number?: string | null;
    neighborhood?: string | null;
    listing_type?: string | null;
    price_range_min?: number | null;
    price_range_max?: number | null;
  }[]) {
    const ap = row.agent_id ? byAgent.get(row.agent_id) : undefined;
    const agent_profile: ListedByAgentProfile | undefined = ap
      ? {
          company: ap.company,
          office_name: ap.office_name,
          first_name: ap.first_name,
          last_name: ap.last_name,
        }
      : undefined;
    out[row.id] = {
      listing_number: row.listing_number != null ? String(row.listing_number) : undefined,
      zip_code: row.zip_code ?? "",
      square_feet: row.square_feet ?? null,
      property_type: row.property_type ?? null,
      created_at: row.created_at,
      status: typeof row.status === "string" ? row.status : undefined,
      agent_id: row.agent_id ?? "",
      agent_profile,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      list_date: row.list_date ?? null,
      unit_number: row.unit_number ?? undefined,
      neighborhood: row.neighborhood?.trim() || undefined,
      listing_type: row.listing_type ?? undefined,
      price_range_min: row.price_range_min ?? null,
      price_range_max: row.price_range_max ?? null,
    };
  }
  return out;
}

function buildFavoriteSplitListings(
  rows: AgentClientFavoriteRpcRow[],
  enrich: Record<string, Partial<ListingCardModel>>,
): AgentSplitListing[] {
  return rows.map((row) => {
    const base = mapAgentClientFavoriteRpcToListingCard(row);
    const extra = enrich[row.listing_id] ?? {};
    return {
      ...base,
      ...extra,
      id: row.listing_id,
      list_date: extra.list_date ?? base.created_at ?? null,
    } as AgentSplitListing;
  });
}

export default function AgentClientFavorites() {
  const { buyerId, clientId } = useParams<{ buyerId?: string; clientId?: string }>();
  /** CRM `clients.id` — Success Hub uses `buyerId`; legacy route uses `clientId`. */
  const crmClientId = buyerId ?? clientId ?? "";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<AgentClientFavoriteRpcRow[]>([]);
  const [listingEnrich, setListingEnrich] = useState<Record<string, Partial<ListingCardModel>>>({});
  const [clientName, setClientName] = useState("");
  const [buyerUserId, setBuyerUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingFavoriteId, setRemovingFavoriteId] = useState<string | null>(null);

  const resultsFromPath = crmClientId
    ? `/agent/buyers/${crmClientId}/favorites`
    : "/agent/buyers";

  const favoriteByListingId = useMemo(() => {
    const map = new Map<string, AgentClientFavoriteRpcRow>();
    for (const row of favorites) {
      map.set(row.listing_id, row);
    }
    return map;
  }, [favorites]);

  useEffect(() => {
    if (!crmClientId) {
      setLoading(false);
      setError("Missing buyer");
      return;
    }
    void loadPage(crmClientId);
  }, [crmClientId]);

  const loadPage = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      setListingEnrich({});
      setBuyerUserId(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        setLoading(false);
        return;
      }

      const { data: clientRow } = await supabase
        .from("clients")
        .select("first_name, last_name, email, phone")
        .eq("id", id)
        .maybeSingle();

      if (!clientRow?.email) {
        setError("Client not found");
        setLoading(false);
        return;
      }

      const fn = typeof clientRow.first_name === "string" ? clientRow.first_name : "";
      const ln = typeof clientRow.last_name === "string" ? clientRow.last_name : "";
      setClientName(formatFavoritesClientDisplayName(fn, ln));

      const { data: profile } = await supabase.from("profiles").select("id").eq("email", clientRow.email).maybeSingle();

      if (!profile?.id) {
        setError("This client hasn't created an account yet");
        setLoading(false);
        return;
      }

      const buyerAuthId = String(profile.id);
      setBuyerUserId(buyerAuthId);

      const { data, error: rpcError } = await supabase.rpc("get_client_favorites_for_agent", {
        p_buyer_user_id: buyerAuthId,
        p_crm_client_id: id,
      });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        setError(
          rpcError.message.includes("No active relationship")
            ? "You don't have an active relationship with this client"
            : "Failed to load favorites",
        );
        setLoading(false);
        return;
      }

      const rows = (data || []) as AgentClientFavoriteRpcRow[];
      setFavorites(rows);

      const listingIds = [...new Set(rows.map((r) => r.listing_id).filter(Boolean))];
      const enrich = await fetchListingEnrichmentForFavorites(listingIds);
      setListingEnrich(enrich);
    } catch (err) {
      console.error(err);
      setError("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const listings = useMemo(
    () => buildFavoriteSplitListings(favorites, listingEnrich),
    [favorites, listingEnrich],
  );

  const handleBack = () => {
    if (crmClientId) {
      navigate(`/agent/buyers/${crmClientId}`);
      return;
    }
    navigate("/my-clients");
  };

  const handleRemoveFavorite = useCallback(
    async (favoriteRow: AgentClientFavoriteRpcRow) => {
      if (!buyerUserId || !crmClientId || removingFavoriteId) return;

      setRemovingFavoriteId(favoriteRow.id);
      try {
        const result = await removeBuyerFavoriteForAgent(supabase, {
          favoriteId: favoriteRow.id,
          buyerUserId,
          crmClientId,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        setFavorites((prev) => prev.filter((f) => f.id !== favoriteRow.id));
        toast.success("Removed from favorites");
      } catch (err) {
        console.error(err);
        toast.error("Failed to remove from favorites");
      } finally {
        setRemovingFavoriteId(null);
      }
    },
    [buyerUserId, crmClientId, removingFavoriteId],
  );

  return (
    <AgentSplitResultsSurface
      listings={listings}
      loading={loading}
      loadError={error}
      emptyMessage="No favorites yet."
      title="Favorites"
      subtitle={
        clientName
          ? `Listings ${clientName} has saved to favorites.`
          : "Listings this buyer has saved to favorites."
      }
      onBack={handleBack}
      resultsFromPath={resultsFromPath}
      showSaveToHotSheet={false}
      allowListView={false}
      loadingMessage="Loading favorites…"
      toolbarAriaLabel="Buyer favorites toolbar"
      seo={{
        title: "Buyer favorites | All Agent Connect",
        description: "View listings your buyer has favorited.",
      }}
      renderListingCard={(listing, helpers) => {
        const favoriteRow = favoriteByListingId.get(listing.id);
        const cardListing = {
          ...mapAgentClientFavoriteRpcToListingCard(
            favoriteRow ?? {
              id: listing.id,
              listing_id: listing.id,
              address: String(listing.address ?? ""),
              city: String(listing.city ?? ""),
              state: String(listing.state ?? ""),
              zip_code: String(listing.zip_code ?? ""),
              price: Number(listing.price ?? 0),
              bedrooms: typeof listing.bedrooms === "number" ? listing.bedrooms : null,
              bathrooms:
                listing.bathrooms == null
                  ? null
                  : Number(listing.bathrooms),
              square_feet: typeof listing.square_feet === "number" ? listing.square_feet : null,
              property_type:
                typeof listing.property_type === "string" ? listing.property_type : null,
              photos: listing.photos,
              created_at:
                typeof listing.created_at === "string" ? listing.created_at : null,
            },
          ),
          ...(listingEnrich[listing.id] ?? {}),
        };

        return (
          <SuccessHubListingCard
            listing={listingRowForAgentSplitMapCompact(cardListing)}
            hideCompactFavorite
            compactSavedHeartOverlay
            onCompactSavedHeartClick={
              favoriteRow
                ? () => {
                    void handleRemoveFavorite(favoriteRow);
                  }
                : undefined
            }
            compactDetailNavigateState={{ from: resultsFromPath }}
            onSelect={helpers.onSelect}
            isSelected={helpers.isSelected}
          />
        );
      }}
    />
  );
}
