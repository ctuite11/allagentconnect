/** Fields used to determine when a listing was added or went live. */
export type ListingRecencyFields = {
  created_at?: string | null;
  list_date?: string | null;
  active_date?: string | null;
};

/** Milliseconds for sort comparison; prefers `created_at`, then list/publish dates. */
export function listingRecencyMs(listing: ListingRecencyFields): number {
  for (const raw of [listing.created_at, listing.list_date, listing.active_date]) {
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

export function compareListingsByRecency(
  a: ListingRecencyFields,
  b: ListingRecencyFields,
  direction: "asc" | "desc" = "desc",
): number {
  const dir = direction === "asc" ? 1 : -1;
  return (listingRecencyMs(a) - listingRecencyMs(b)) * dir;
}

export function sortListingsByRecency<T extends ListingRecencyFields>(
  listings: T[],
  direction: "asc" | "desc" = "desc",
): T[] {
  return [...listings].sort((a, b) => compareListingsByRecency(a, b, direction));
}

/** Default DB / client sort column for “newest first” listing results. */
export const LISTING_DEFAULT_SORT_COLUMN = "created_at";
