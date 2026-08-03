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
 * - Partial range (only min or max) → omitted
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

/**
 * Dollar amount used for compact “single figure” UX: fixed price, else high end of range, else lone endpoint.
 */
function listingCompactPrimaryAmount(listing: ListingPriceFields): number | null {
  const price = positiveOrNull(listing.price);
  if (price != null) return price;
  const min = positiveOrNull(listing.price_range_min);
  const max = positiveOrNull(listing.price_range_max);
  if (min != null && max != null) return Math.max(min, max);
  if (min != null) return min;
  if (max != null) return max;
  return null;
}

/** Whole dollars for inline price inputs: comma grouping, no currency symbol. */
export function formatUsdWholeForInput(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, useGrouping: true }).format(n);
}

/**
 * Parses typing in a whole-dollar price field (`425000`, `425,000`, `$425k` digits).
 * @returns `""` when empty, otherwise a non-negative integer.
 */
export function parseUsdWholeInput(raw: string): number | "" {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits === "") return "";
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 0) return "";
  return n;
}

/** Full currency for compact primary figure (non-map callers). Maps use {@link formatListingMapPinTruncated}. */
export function formatListingPriceDisplayCompactPrimary(listing: ListingPriceFields): string | null {
  const n = listingCompactPrimaryAmount(listing);
  return n != null ? usdWhole(n) : null;
}

/**
 * **Google Map pins only**: AAC/Zillow-style short labels (`$2M`, `$1.38M`, `$600K`, `$346K`).
 * Same numeric basis as {@link formatListingPriceDisplayCompactPrimary}; never emits bare numbers or `$0`.
 */
export function formatListingMapPinTruncated(listing: ListingPriceFields): string | null {
  const n = listingCompactPrimaryAmount(listing);
  if (n == null) return null;
  return truncateUsdForMapPin(n);
}

function truncateUsdForMapPin(v: number): string {
  const rounded = Math.round(v);
  if (rounded <= 0) return "";

  if (rounded >= 10_000_000) {
    const m = rounded / 1_000_000;
    return `$${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (rounded >= 1_000_000) {
    const m = rounded / 1_000_000;
    return `$${parseFloat(m.toFixed(2)).toString()}M`;
  }
  if (rounded >= 100_000) {
    return `$${Math.round(rounded / 1_000)}K`;
  }
  // Below $100K (rentals, low-priced listings): show the real price, no rounding.
  return usdWhole(rounded);
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
