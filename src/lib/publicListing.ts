import { supabase } from "@/integrations/supabase/client";
import type { PublicListingAgentRow, PublicListingRow } from "@/lib/publicListingModel";

export type { PublicListingAgentRow, PublicListingRow } from "@/lib/publicListingModel";
export {
  resolvePublicAgentPhones,
  toPublicAgentProfile,
  toPublicListingViewModel,
} from "@/lib/publicListingModel";

function firstRow<T>(data: T[] | T | null | undefined): T | null {
  if (data == null) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

/**
 * Marketing-only listing payload for anonymous shared-listing guests.
 * Uses `get_public_listing` — never falls back to `listings.select("*")`.
 */
export async function fetchPublicListing(
  listingId: string,
): Promise<PublicListingRow | null> {
  const { data, error } = await supabase.rpc("get_public_listing", {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return firstRow(data);
}

/**
 * Listing-agent business contact for a publicly eligible listing.
 * Resolved only through the listing — caller never supplies an agent id.
 */
export async function fetchPublicListingAgent(
  listingId: string,
): Promise<PublicListingAgentRow | null> {
  const { data, error } = await supabase.rpc("get_public_listing_agent", {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return firstRow(data);
}
