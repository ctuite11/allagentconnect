import type { FilterState } from "@/components/listing-search/ListingSearchFilters";
import {
  RENT_PRICE_ABS_MIN,
  RENT_PRICE_ABS_MAX,
  SALE_PRICE_ABS_MIN,
  SALE_PRICE_ABS_MAX,
} from "@/lib/buyerSearchRentFilters";

/** Default property-type chips on agent listing search (sale). */
export const AGENT_SALE_DEFAULT_PROPERTY_TYPES = ["single_family", "condo"] as const;

/** UI marker for rental searches; actual rentals match via `listing_type`. */
export const RESIDENTIAL_RENTAL_PROPERTY_TYPE = "residential_rental";

type ListingType = FilterState["listingType"];

/** Clamp price fields when switching between sale and rent bounds. */
export function clampListingSearchPrices(
  filters: Pick<FilterState, "priceMin" | "priceMax">,
  listingType: ListingType,
): Pick<FilterState, "priceMin" | "priceMax"> {
  const bounds =
    listingType === "for_rent"
      ? { min: RENT_PRICE_ABS_MIN, max: RENT_PRICE_ABS_MAX }
      : { min: SALE_PRICE_ABS_MIN, max: SALE_PRICE_ABS_MAX };
  const pmin = filters.priceMin ? parseInt(filters.priceMin, 10) : NaN;
  const pmax = filters.priceMax ? parseInt(filters.priceMax, 10) : NaN;
  return {
    priceMin:
      Number.isFinite(pmin) && pmin >= bounds.min && pmin <= bounds.max ? filters.priceMin : "",
    priceMax:
      Number.isFinite(pmax) && pmax >= bounds.min && pmax <= bounds.max ? filters.priceMax : "",
  };
}

/**
 * Agent search scopes rentals via `listing_type`; property-type chips are sale-oriented
 * and exclude types like apartment unless the user picks them explicitly.
 */
export function defaultPropertyTypesForAgentListingSearch(
  listingType: ListingType,
): string[] {
  return listingType === "for_rent" ? [] : [...AGENT_SALE_DEFAULT_PROPERTY_TYPES];
}

/**
 * Property types sent to Supabase. `residential_rental` is a UI sync with For Rent only —
 * rentals in the DB use `listing_type = for_rent` with types like single_family or apartment.
 */
export function propertyTypesForAgentListingQuery(
  listingType: ListingType,
  propertyTypes: string[],
): string[] {
  const withoutRentalMarker = propertyTypes.filter(
    (type) => type !== RESIDENTIAL_RENTAL_PROPERTY_TYPE,
  );
  if (listingType === "for_rent") {
    return withoutRentalMarker;
  }
  return withoutRentalMarker;
}

/** Keep Residential Rental checkbox and For Rent toggle in sync. */
export function syncAgentListingSearchPropertyTypes(
  filters: FilterState,
  type: string,
  selecting: boolean,
): FilterState {
  if (type === RESIDENTIAL_RENTAL_PROPERTY_TYPE && selecting) {
    return {
      ...filters,
      listingType: "for_rent",
      propertyTypes: [RESIDENTIAL_RENTAL_PROPERTY_TYPE],
      ...clampListingSearchPrices(filters, "for_rent"),
    };
  }

  const updated = selecting
    ? [...filters.propertyTypes, type]
    : filters.propertyTypes.filter((t) => t !== type);

  if (
    selecting &&
    type !== RESIDENTIAL_RENTAL_PROPERTY_TYPE &&
    filters.propertyTypes.includes(RESIDENTIAL_RENTAL_PROPERTY_TYPE)
  ) {
    return {
      ...filters,
      listingType: "for_sale",
      propertyTypes: updated.filter((t) => t !== RESIDENTIAL_RENTAL_PROPERTY_TYPE),
      ...clampListingSearchPrices(filters, "for_sale"),
    };
  }

  return { ...filters, propertyTypes: updated };
}

export function syncListingTypeFromPropertyTypes(f: FilterState): void {
  if (f.propertyTypes.includes(RESIDENTIAL_RENTAL_PROPERTY_TYPE)) {
    f.listingType = "for_rent";
  }
}
