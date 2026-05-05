import type { ComponentProps } from "react";
import ListingCard from "@/components/ListingCard";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";
import { LISTING_STATUS } from "@/constants/status";

export type ListingCardModel = ComponentProps<typeof ListingCard>["listing"];

/** Row shape from RPC `get_client_favorites_for_agent` (joined listing fields). */
export type AgentClientFavoriteRpcRow = {
  listing_id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  price: number | string | null;
  bedrooms: number | null;
  bathrooms: number | string | null;
  square_feet: number | null;
  property_type: string | null;
  photos: unknown;
  created_at?: string | null;
};

/** Agent «client favorites» page — same `ListingCard` model as Success Hub grids. */
export function mapAgentClientFavoriteRpcToListingCard(row: AgentClientFavoriteRpcRow): ListingCardModel {
  const priceRaw = row.price;
  const baths = row.bathrooms;
  return {
    id: row.listing_id,
    address: row.address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    zip_code: row.zip_code ?? "",
    price: typeof priceRaw === "number" ? priceRaw : Number(priceRaw ?? 0),
    property_type: row.property_type,
    bedrooms: row.bedrooms,
    bathrooms: baths == null ? null : Number(baths),
    square_feet: row.square_feet,
    status: LISTING_STATUS.ACTIVE,
    photos: row.photos,
    created_at: row.created_at ?? undefined,
    listing_stats: {
      view_count: 0,
      save_count: 0,
      contact_count: 0,
      showing_request_count: 0,
      cumulative_active_days: 0,
    },
  } as ListingCardModel;
}

/** Map Supabase market-activity row for `ListingCard`. */
export function mapMarketRowToListingCard(row: {
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
  neighborhood?: string | null;
  /** Display brokerage once via listing attribution (avoid duplicate agentInfo + Listed by). */
  brokerage?: string;
}): ListingCardModel {
  const broker = row.brokerage?.trim();
  return {
    id: row.id,
    address: row.address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    zip_code: row.zip_code ?? "",
    price: typeof row.price === "number" ? row.price : 0,
    property_type: row.property_type,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    square_feet: row.square_feet,
    status: row.status,
    photos: row.photos,
    created_at: row.created_at,
    agent_id: row.agent_id,
    neighborhood: row.neighborhood?.trim() || undefined,
    brokerage_name: broker || undefined,
    listing_stats: {
      view_count: 0,
      save_count: 0,
      contact_count: 0,
      showing_request_count: 0,
      cumulative_active_days: 0,
    },
  } as ListingCardModel;
}

/** Map Success Hub summary listing preview for `ListingCard`. */
export function mapSummaryListingToListingCard(
  l: SuccessHubSummary["listings"][number],
  agentId: string | undefined,
  listedByProfile: SuccessHubSummary["profile"] = null,
): ListingCardModel {
  const company = listedByProfile?.company?.trim();
  const fullName = [listedByProfile?.first_name, listedByProfile?.last_name]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id: l.id,
    address: l.address,
    city: l.city,
    state: l.state,
    zip_code: l.zip_code ?? "",
    price: l.price ?? 0,
    property_type: l.property_type,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    square_feet: l.square_feet,
    status: l.status,
    photos: l.photos,
    brokerage_name: company || undefined,
    listing_agent_name: !company && fullName ? fullName : undefined,
    listing_stats: {
      view_count: l.view_count,
      save_count: 0,
      contact_count: 0,
      showing_request_count: l.showing_request_count,
      cumulative_active_days: 0,
    },
    agent_id: agentId,
    neighborhood: l.neighborhood?.trim() || undefined,
  };
}
