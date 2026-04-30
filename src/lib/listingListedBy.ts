/** Shared “Listed by” label for ListingCard / SearchListingCard (brokerage/agent priority). */

export type ListedBySource = {
  brokerage_name?: string | null;
  listing_brokerage?: string | null;
  listing_agent_name?: string | null;
  agent_name?: string | null;
};

export function resolveListedByAttribution(listing: ListedBySource): string | null {
  const candidates = [
    listing.brokerage_name,
    listing.listing_brokerage,
    listing.listing_agent_name,
    listing.agent_name,
  ];
  for (const c of candidates) {
    if (typeof c === "string") {
      const t = c.trim();
      if (t) return t;
    }
  }
  return null;
}
