/**
 * Single source for buyer “saved listings” on the dashboard card:
 * - Generic MLS favorites: `favorites.user_id ===` buyer auth UUID (same as /client/dashboard).
 * - Agents: `get_client_favorites_for_agent(p_buyer_user_id, p_crm_client_id?)` reads those rows after RPC auth
 *   (CRM ownership / `crm_client_id` relationship / legacy auth `client_id` relationship).
 * - Hot sheet saves: `hot_sheet_favorites` uses `hot_sheet_id` + `listing_id` only — see ClientHotSheet.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientDashboardFavoriteRow } from "@/components/buyer/ClientDashboardView";

const LISTING_FIELDS = "id, address, city, state, price, bedrooms, bathrooms, photos";

export type BuyerFavoritesAccess = "buyer_self" | "agent_mirror";

function listingFromRecord(single: Record<string, unknown>): ClientDashboardFavoriteRow["listing"] {
  return {
    id: String(single.id),
    address: String(single.address ?? ""),
    city: String(single.city ?? ""),
    state: String(single.state ?? ""),
    price: Number(single.price ?? 0),
    bedrooms: single.bedrooms == null ? null : Number(single.bedrooms),
    bathrooms: single.bathrooms == null ? null : Number(single.bathrooms),
    photos: single.photos,
  };
}

function normalizeFavoritesJoin(data: unknown, limit: number): ClientDashboardFavoriteRow[] {
  if (!data || !Array.isArray(data)) return [];
  type Row = {
    id: string;
    listing?: ClientDashboardFavoriteRow["listing"] | ClientDashboardFavoriteRow["listing"][] | null;
  };
  const out: ClientDashboardFavoriteRow[] = [];
  for (const row of data as Row[]) {
    const raw = row.listing;
    const single = Array.isArray(raw) ? raw[0] : raw;
    if (single == null || typeof single !== "object") continue;
    out.push({
      id: String(row.id),
      listing: listingFromRecord(single as Record<string, unknown>),
    });
    if (out.length >= limit) break;
  }
  return out;
}

type ClientFavoriteRpcRow = {
  id: string;
  listing_id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  price: number | string | null;
  bedrooms: number | null;
  bathrooms: number | string | null;
  photos: unknown;
};

function mapRpcToDashboardFavorites(rows: ClientFavoriteRpcRow[], limit: number): ClientDashboardFavoriteRow[] {
  const out: ClientDashboardFavoriteRow[] = [];
  for (const row of rows) {
    if (!row.listing_id) continue;
    out.push({
      id: String(row.id),
      listing: {
        id: String(row.listing_id),
        address: String(row.address ?? ""),
        city: String(row.city ?? ""),
        state: String(row.state ?? ""),
        price: Number(row.price ?? 0),
        bedrooms: row.bedrooms ?? null,
        bathrooms: row.bathrooms == null ? null : Number(row.bathrooms),
        photos: row.photos,
      },
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Load generic favorites for the dashboard preview: always `favorites.user_id === buyerAuthUserId`
 * (buyer auth UUID — not CRM `clients.id`).
 */
export async function loadBuyerGenericFavorites(
  supabase: SupabaseClient,
  buyerAuthUserId: string,
  access: BuyerFavoritesAccess,
  options?: { limit?: number; crmClientId?: string | null },
): Promise<ClientDashboardFavoriteRow[]> {
  const limit = options?.limit ?? (access === "buyer_self" ? 6 : 40);
  const crmClientId = options?.crmClientId ?? null;

  if (access === "buyer_self") {
    const { data, error } = await supabase
      .from("favorites")
      .select(
        `
        id,
        listing:listings (${LISTING_FIELDS})
      `,
      )
      .eq("user_id", buyerAuthUserId)
      .limit(limit);

    if (error) {
      console.warn("loadBuyerGenericFavorites buyer_self:", error.message);
      return [];
    }
    return normalizeFavoritesJoin(data, limit);
  }

  const rpcPayload: {
    p_buyer_user_id: string;
    p_crm_client_id?: string;
  } = {
    p_buyer_user_id: buyerAuthUserId,
  };
  if (crmClientId) {
    rpcPayload.p_crm_client_id = crmClientId;
  }

  const { data: rpcRows, error: rpcErr } = await supabase.rpc("get_client_favorites_for_agent", rpcPayload);

  if (rpcErr) {
    console.warn("loadBuyerGenericFavorites agent_mirror:", rpcErr.message);
    return [];
  }

  return mapRpcToDashboardFavorites((rpcRows ?? []) as ClientFavoriteRpcRow[], limit);
}

export type HotSheetFavoriteRow = { id: string; listing_id: string };

/**
 * Raw `hot_sheet_favorites` rows for the given hot sheet ids (columns: hot_sheet_id, listing_id, id).
 */
export async function fetchHotSheetFavoriteRowsForHotSheetIds(
  supabase: SupabaseClient,
  hotSheetIds: string[],
): Promise<HotSheetFavoriteRow[]> {
  if (hotSheetIds.length === 0) return [];
  const { data, error } = await supabase
    .from("hot_sheet_favorites")
    .select("id, listing_id")
    .in("hot_sheet_id", hotSheetIds);

  if (error) {
    console.warn("fetchHotSheetFavoriteRowsForHotSheetIds:", error.message);
    return [];
  }
  return (data ?? []) as HotSheetFavoriteRow[];
}

/**
 * Append hot sheet saves to generic favorites; dedupe by listing id (generic wins).
 */
export async function mergeHotSheetFavoriteRowsIntoBuyerFavorites(
  supabase: SupabaseClient,
  generic: ClientDashboardFavoriteRow[],
  hotSheetFavoriteRows: HotSheetFavoriteRow[],
): Promise<ClientDashboardFavoriteRow[]> {
  const seen = new Set(generic.map((f) => f.listing.id));
  const merged: ClientDashboardFavoriteRow[] = [...generic];

  if (hotSheetFavoriteRows.length === 0) return merged;

  const listingIds = [...new Set(hotSheetFavoriteRows.map((r) => r.listing_id))];
  const { data: listingsRows, error } = await supabase
    .from("listings")
    .select(LISTING_FIELDS)
    .in("id", listingIds);

  if (error) {
    console.warn("mergeHotSheetFavoriteRowsIntoBuyerFavorites listings:", error.message);
    return merged;
  }

  const byId = new Map((listingsRows ?? []).map((l) => [l.id, l as Record<string, unknown>]));
  for (const row of hotSheetFavoriteRows) {
    const raw = byId.get(row.listing_id);
    if (!raw) continue;
    const lid = String(raw.id);
    if (seen.has(lid)) continue;
    seen.add(lid);
    merged.push({
      id: `hsf-${row.id}`,
      listing: listingFromRecord(raw),
    });
  }
  return merged;
}
