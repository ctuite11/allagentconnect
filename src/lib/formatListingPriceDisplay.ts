/**
 * AAC listing price display using DB fields `price`, `price_range_min`, `price_range_max`
 * (same names as Add Listing / `listings` table).
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
 * Human-readable price or range for cards (no `$0` when empty).
 * - Both range ends → `$350,000 – $425,000`
 * - Else single `price` → one amount
 * - Else one range end only → that amount
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
  if (min != null) return usdWhole(min);
  if (max != null) return usdWhole(max);
  return null;
}

/**
 * **Map pins only** (`PropertyMap`). Full-range listing cards use {@link formatListingPriceDisplay}.
 * - Fixed `price` → that amount (`$`-formatted whole dollars, never `$0`).
 * - Min + max range → **higher** endpoint only, e.g. `$425,000` for 350k–425k.
 * - Single range endpoint → that value only.
 * - No usable amount → `null` (map shows `—`).
 */
export function formatListingPriceDisplayCompactPrimary(listing: ListingPriceFields): string | null {
  const price = positiveOrNull(listing.price);
  if (price != null) return usdWhole(price);
  const min = positiveOrNull(listing.price_range_min);
  const max = positiveOrNull(listing.price_range_max);
  if (min != null && max != null) return usdWhole(Math.max(min, max));
  if (min != null) return usdWhole(min);
  if (max != null) return usdWhole(max);
  return null;
}

/** Single numeric basis for sort, $/sqft, quick-edit seed: prefers `price`, else midpoint or one end of range. */
export function listingEffectiveNumericPrice(listing: ListingPriceFields): number | null {
  const price = positiveOrNull(listing.price);
  if (price != null) return price;
  const min = positiveOrNull(listing.price_range_min);
  const max = positiveOrNull(listing.price_range_max);
  if (min != null && max != null) return (min + max) / 2;
  if (min != null) return min;
  if (max != null) return max;
  return null;
}
