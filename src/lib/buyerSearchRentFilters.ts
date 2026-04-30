import type { SearchCriteria } from "@/components/search/UnifiedPropertySearch";

/** Sale bounds (BuyerMapSearch slider + snap). */
export const SALE_PRICE_ABS_MIN = 50_000;
export const SALE_PRICE_ABS_MAX = 10_000_000;

/** Monthly rent bounds — max is slider top; listings use lte when user caps below $10k. */
export const RENT_PRICE_ABS_MIN = 500;
export const RENT_PRICE_ABS_MAX = 10_000;

/** Slider / snap steps for rental searches (minimum $500 through $10,000+ top cap). */
export const RENT_PRICE_STEP_VALUES = [
  500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 7500, 10_000,
] as const;

export const DEFAULT_RENTAL_PROPERTY_TYPES = ["residential_rental"] as const;

export function salePriceStepValues(): number[] {
  const values: number[] = [];
  for (let v = 50_000; v <= 500_000; v += 25_000) values.push(v);
  for (let v = 550_000; v <= 1_000_000; v += 50_000) values.push(v);
  for (let v = 1_250_000; v <= 5_000_000; v += 250_000) values.push(v);
  for (let v = 6_000_000; v <= 10_000_000; v += 1_000_000) values.push(v);
  return values;
}

/** Default buyer map / browse toolbar state for rentals (aligns with sale defaults + rental property type). */
export function defaultRentToolbarCriteria(): SearchCriteria {
  return {
    listingType: "for_rent",
    state: "MA",
    county: "all",
    towns: [],
    showAreas: true,
    propertyTypes: [...DEFAULT_RENTAL_PROPERTY_TYPES],
    statuses: ["coming_soon", "active", "off_market", "back_on_market"],
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
    zipCode: "",
    neighborhoods: undefined,
    minLivingArea: "",
    maxLivingArea: "",
  };
}
