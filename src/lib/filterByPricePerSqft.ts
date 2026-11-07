import { listingEffectiveNumericPrice, type ListingPriceFields } from "./formatListingPriceDisplay";

type PricedListing = ListingPriceFields & { square_feet?: number | null };

/** Use the same effective price as listing sorting, including range-only listings. */
export function filterByPricePerSqft<T extends PricedListing>(
  listings: T[], minPpsf: string, maxPpsf: string,
): T[] {
  const minValue = Number(minPpsf.replace(/,/g, ""));
  const maxValue = Number(maxPpsf.replace(/,/g, ""));
  const min = Number.isFinite(minValue) && minValue > 0 ? minValue : null;
  const max = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : null;
  if (min === null && max === null) return listings;
  return listings.filter((listing) => {
    const price = listingEffectiveNumericPrice(listing);
    const sqft = Number(listing.square_feet);
    if (price === null || !Number.isFinite(sqft) || sqft <= 0) return false;
    const ppsf = price / sqft;
    return (min === null || ppsf >= min) && (max === null || ppsf <= max);
  });
}
