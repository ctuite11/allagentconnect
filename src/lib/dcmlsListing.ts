import { supabase } from "@/integrations/supabase/client";
import type { PublicListingRow } from "@/lib/publicListingModel";

function firstRow<T>(data: T[] | T | null | undefined): T | null {
  if (data == null) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

/**
 * Gated DCMLS listing payload.
 * Uses `get_dcmls_listing` — never falls back to `get_public_listing` or `listings`.
 * Server enforces participation + publish_to_dcmls + published + public status.
 */
export async function fetchDcmlsListing(
  listingId: string,
): Promise<PublicListingRow | null> {
  const { data, error } = await supabase.rpc("get_dcmls_listing", {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return firstRow(data) as PublicListingRow | null;
}

/** Agent-level DCMLS participation from agent_settings. */
export async function fetchDcmlsParticipation(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("agent_settings")
    .select("dcmls_participation")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.dcmls_participation === true;
}
