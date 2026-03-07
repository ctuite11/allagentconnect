import { supabase } from "@/integrations/supabase/client";

/**
 * Statuses that block creation of a new listing at the same address.
 */
const BLOCKING_STATUSES = [
  "active",
  "new",
  "coming_soon",
  "off_market",
  "back_on_market",
  "price_changed",
  "extended",
  "reactivated",
  "under_agreement",
  "pending",
  "contingent",
] as const;

/** Normalize an address string for comparison. */
function norm(s: string | null | undefined): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");       // collapse repeated spaces
}

export interface DuplicateCheckParams {
  address: string;
  city: string;
  state: string;
  zip: string;
  /** Exclude this listing ID (for edit mode). */
  excludeListingId?: string | null;
}

export interface DuplicateResult {
  found: boolean;
  status?: string;
  listingId?: string;
}

/**
 * Check whether another listing already exists at the same normalized
 * address + city + state + zip in a blocking (live/published) status.
 *
 * Returns `{ found: false }` when no conflict exists.
 */
export async function checkDuplicateListing(
  params: DuplicateCheckParams
): Promise<DuplicateResult> {
  const { address, city, state, zip, excludeListingId } = params;

  // Don't query if minimum fields are missing
  if (!norm(address) || !norm(city) || !norm(state)) {
    return { found: false };
  }

  // Query all listings matching the same address / city / state / zip in a blocking status.
  // Supabase ilike is case-insensitive; we still normalise whitespace client-side.
  let query = supabase
    .from("listings")
    .select("id, status")
    .ilike("address", norm(address))
    .ilike("city", norm(city))
    .ilike("state", norm(state))
    .in("status", [...BLOCKING_STATUSES]);

  // ZIP: match when both sides are non-empty
  const normZip = norm(zip);
  if (normZip) {
    query = query.ilike("zip_code", normZip);
  }

  // Exclude self when editing
  if (excludeListingId) {
    query = query.neq("id", excludeListingId);
  }

  query = query.limit(1);

  const { data, error } = await query;

  if (error) {
    console.error("[checkDuplicateListing] query error:", error);
    // Fail open – don't block the user on a transient error
    return { found: false };
  }

  if (data && data.length > 0) {
    return {
      found: true,
      status: data[0].status,
      listingId: data[0].id,
    };
  }

  return { found: false };
}

/**
 * Returns true when the target status is a live/published status
 * (i.e. one that should trigger a duplicate check).
 */
export function isLiveStatus(status: string): boolean {
  return (BLOCKING_STATUSES as readonly string[]).includes(status);
}
