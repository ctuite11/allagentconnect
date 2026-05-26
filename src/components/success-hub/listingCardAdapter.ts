import type { ComponentProps } from "react";
import ListingCard from "@/components/ListingCard";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";
import { LISTING_STATUS } from "@/constants/status";
import {
  listingAgentContactFromRow,
  listingEmailSubjectFromRow,
  type ListingAgentContact,
} from "@/lib/listingAgentContact";

export type ListingCardModel = ComponentProps<typeof ListingCard>["listing"];

/** Agent contact + email subject for Success Hub `ListingCard` tiles (explicit, not inferred in-card). */
export function successHubListingAttributionProps(listing: ListingCardModel): {
  listingAgentContact: ListingAgentContact | null;
  listingEmailSubject: string | undefined;
} {
  return {
    listingAgentContact: listingAgentContactFromRow(listing),
    listingEmailSubject: listingEmailSubjectFromRow(listing),
  };
}

/** Row shape from RPC `get_client_favorites_for_agent` (joined listing fields). */
export type AgentClientFavoriteRpcRow = {
  id: string;
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
  listing_type?: string | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: unknown;
  status: string;
  created_at: string;
  active_date?: string | null;
  listing_number?: string | null;
  agent_id: string;
  neighborhood?: string | null;
  unit_number?: string | null;
  condo_details?: unknown;
  /** Display brokerage once via listing attribution (avoid duplicate agentInfo + Listed by). */
  brokerage?: string;
  agent_email?: string | null;
  listing_agent_name?: string | null;
  agent_name?: string | null;
}): ListingCardModel {
  const broker = row.brokerage?.trim();
  const agentEmail = row.agent_email?.trim();
  const agentName =
    row.listing_agent_name?.trim() || row.agent_name?.trim() || undefined;
  return {
    id: row.id,
    address: row.address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    zip_code: row.zip_code ?? "",
    price: typeof row.price === "number" ? row.price : 0,
    price_range_min: typeof row.price_range_min === "number" ? row.price_range_min : null,
    price_range_max: typeof row.price_range_max === "number" ? row.price_range_max : null,
    property_type: row.property_type,
    listing_type: row.listing_type ?? undefined,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    square_feet: row.square_feet,
    status: row.status,
    photos: row.photos,
    created_at: row.created_at,
    active_date: row.active_date ?? undefined,
    listing_number: row.listing_number ?? undefined,
    agent_id: row.agent_id,
    neighborhood: row.neighborhood?.trim() || undefined,
    unit_number:
      row.unit_number != null && String(row.unit_number).trim() !== ""
        ? String(row.unit_number).trim()
        : undefined,
    condo_details: row.condo_details ?? undefined,
    brokerage_name: broker || undefined,
    agent_email: agentEmail || undefined,
    listing_agent_name: agentName,
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
    price_range_min: typeof l.price_range_min === "number" ? l.price_range_min : null,
    price_range_max: typeof l.price_range_max === "number" ? l.price_range_max : null,
    property_type: l.property_type,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    square_feet: l.square_feet,
    status: l.status,
    photos: l.photos,
    listing_number: typeof l.listing_number === "string" ? l.listing_number : undefined,
    active_date: typeof l.active_date === "string" ? l.active_date : undefined,
    created_at: typeof l.created_at === "string" ? l.created_at : undefined,
    brokerage_name: company || undefined,
    agent_email: listedByProfile?.email?.trim() || undefined,
    listing_agent_name: fullName || undefined,
    listing_stats: {
      view_count: l.view_count,
      save_count: 0,
      contact_count: 0,
      showing_request_count: l.showing_request_count,
      cumulative_active_days: 0,
    },
    agent_id: agentId,
    neighborhood: l.neighborhood?.trim() || undefined,
    unit_number: typeof l.unit_number === "string" ? l.unit_number : undefined,
    condo_details: l.condo_details,
  };
}
