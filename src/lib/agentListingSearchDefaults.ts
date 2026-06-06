/** Default property-type chips on agent listing search (sale). */
export const AGENT_SALE_DEFAULT_PROPERTY_TYPES = ["single_family", "condo"] as const;

/**
 * Agent search scopes rentals via `listing_type`; property-type chips are sale-oriented
 * and exclude types like apartment unless the user picks them explicitly.
 */
export function defaultPropertyTypesForAgentListingSearch(
  listingType: "for_sale" | "for_rent",
): string[] {
  return listingType === "for_rent" ? [] : [...AGENT_SALE_DEFAULT_PROPERTY_TYPES];
}
