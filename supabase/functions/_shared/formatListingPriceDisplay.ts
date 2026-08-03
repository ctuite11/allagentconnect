/**
 * Deno mirror of `src/lib/formatListingPriceDisplay.ts` (`formatListingPriceDisplay`).
 *
 * Behavior is intentionally identical to the app helper, including partial
 * ranges: when only one endpoint is present the price is OMITTED (null), the
 * app never renders a "From $…" / "Up to $…" label. Keep both files in sync.
 */

export type ListingPriceFields = {
  price?: number | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
};

function usdWhole(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function positiveOrNull(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

/**
 * Human-readable price or range (never `$0`).
 * - Fixed `price` → `$425,000`
 * - Both range ends → `$350,000 – $425,000`
 * - Partial range (only min or only max) → `null` (omitted)
 */
export function formatListingPriceDisplay(listing: ListingPriceFields): string | null {
  const price = positiveOrNull(listing.price);
  if (price != null) return usdWhole(price);
  const min = positiveOrNull(listing.price_range_min);
  const max = positiveOrNull(listing.price_range_max);
  if (min != null && max != null) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return `${usdWhole(lo)} – ${usdWhole(hi)}`;
  }
  return null;
}

/** Price display with `/month` appended for rentals. Returns `null` when there is no usable price. */
export function formatListingPriceForShare(
  listing: ListingPriceFields & { listing_type?: string | null },
): string | null {
  const base = formatListingPriceDisplay(listing);
  if (base == null) return null;
  return listing.listing_type === "for_rent" ? `${base}/month` : base;
}
