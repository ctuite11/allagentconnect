import type { FilterState } from "@/components/listing-search/ListingSearchFilters";
import { PROPERTY_TYPES } from "@/constants/status";
import {
  RENT_PRICE_ABS_MIN,
  RENT_PRICE_ABS_MAX,
  SALE_PRICE_ABS_MIN,
  SALE_PRICE_ABS_MAX,
} from "@/lib/buyerSearchRentFilters";

/** Default property-type chips on agent listing search (sale). */
export const AGENT_SALE_DEFAULT_PROPERTY_TYPES = ["single_family", "condo"] as const;

/**
 * Legacy URL marker. Not a property-type checkbox on agent listing search.
 * Older links used it to mean For Rent; queries still match via `listing_type`.
 */
export const RESIDENTIAL_RENTAL_PROPERTY_TYPE = "residential_rental";

/** Property-type checkboxes on agent listing search (sale and rent). */
export const AGENT_LISTING_SEARCH_PROPERTY_TYPES = PROPERTY_TYPES.filter(
  (type) => type.value !== RESIDENTIAL_RENTAL_PROPERTY_TYPE,
);

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

export function withoutResidentialRentalPropertyType(propertyTypes: string[]): string[] {
  return propertyTypes.filter((type) => type !== RESIDENTIAL_RENTAL_PROPERTY_TYPE);
}

/**
 * Property types sent to Supabase. `residential_rental` is not a listings filter —
 * sale vs rent is `listing_type`.
 */
export function propertyTypesForAgentListingQuery(
  _listingType: ListingType,
  propertyTypes: string[],
): string[] {
  return withoutResidentialRentalPropertyType(propertyTypes);
}

/** Toggle a property type without changing the For Sale / For Rent control. */
export function syncAgentListingSearchPropertyTypes(
  filters: FilterState,
  type: string,
  selecting: boolean,
): FilterState {
  if (type === RESIDENTIAL_RENTAL_PROPERTY_TYPE) {
    return {
      ...filters,
      propertyTypes: withoutResidentialRentalPropertyType(filters.propertyTypes),
    };
  }

  const updated = selecting
    ? [...filters.propertyTypes, type]
    : filters.propertyTypes.filter((t) => t !== type);

  return {
    ...filters,
    propertyTypes: withoutResidentialRentalPropertyType(updated),
  };
}

/**
 * Older shared links used `residential_rental` as a For Rent marker.
 * Honor that listing type, then drop the marker so it is not a selected type.
 */
export function syncListingTypeFromPropertyTypes(f: FilterState): void {
  if (f.propertyTypes.includes(RESIDENTIAL_RENTAL_PROPERTY_TYPE)) {
    f.listingType = "for_rent";
    f.propertyTypes = withoutResidentialRentalPropertyType(f.propertyTypes);
  }
}
