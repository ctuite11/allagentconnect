/**
 * Canonical listing pricing rules for non-draft statuses.
 *
 * FOR SALE / private sale: price > 0 OR (price_range_min > 0 AND price_range_max > 0)
 * FOR RENT: price > 0 (UI "monthly rent" is stored in `price` — there is no monthly_rent column)
 * Draft: unrestricted
 */

export type ListingPricingFields = {
  listing_type?: string | null;
  status?: string | null;
  price?: number | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  /** UI-only alias; treated as `price` when provided. */
  monthly_rent?: number | null;
};

function positiveOrNull(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function isDraftListingStatus(status: string | null | undefined): boolean {
  return !status || status === "draft";
}

export function isRentalListingType(listingType: string | null | undefined): boolean {
  return listingType === "for_rent";
}

/** True when pricing satisfies the product rule (independent of status). */
export function listingHasValidPricing(listing: ListingPricingFields): boolean {
  if (isRentalListingType(listing.listing_type)) {
    const rent = positiveOrNull(listing.monthly_rent) ?? positiveOrNull(listing.price);
    return rent != null;
  }
  if (positiveOrNull(listing.price) != null) return true;
  const min = positiveOrNull(listing.price_range_min);
  const max = positiveOrNull(listing.price_range_max);
  return min != null && max != null;
}

/**
 * Non-draft listings must have valid pricing. Drafts always pass.
 */
export function listingSatisfiesPricingRule(listing: ListingPricingFields): boolean {
  if (isDraftListingStatus(listing.status)) return true;
  return listingHasValidPricing(listing);
}

export function listingMissingPricingMessage(listing: ListingPricingFields): string {
  if (isRentalListingType(listing.listing_type)) {
    return "Add a monthly rent in Edit Listing before setting a non-draft status.";
  }
  return "Add a Price or Price Range in Edit Listing before setting a non-draft status.";
}

/** Form-string variant used by Add Listing. */
export function formHasValidListingPricing(input: {
  listing_type: string;
  price?: string | number | null;
  price_range_min?: string | number | null;
  price_range_max?: string | number | null;
  monthly_rent?: string | number | null;
}): boolean {
  return listingHasValidPricing({
    listing_type: input.listing_type,
    price: input.price == null || input.price === "" ? null : Number(input.price),
    price_range_min:
      input.price_range_min == null || input.price_range_min === ""
        ? null
        : Number(input.price_range_min),
    price_range_max:
      input.price_range_max == null || input.price_range_max === ""
        ? null
        : Number(input.price_range_max),
    monthly_rent:
      input.monthly_rent == null || input.monthly_rent === ""
        ? null
        : Number(input.monthly_rent),
  });
}
