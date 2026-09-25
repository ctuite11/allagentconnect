import { describe, expect, it } from "vitest";
import { initialFilters } from "@/components/listing-search/ListingSearchFilters";
import { parseAdvancedParams } from "@/lib/buildSearchParams";
import {
  AGENT_LISTING_SEARCH_PROPERTY_TYPES,
  RESIDENTIAL_RENTAL_PROPERTY_TYPE,
  defaultPropertyTypesForAgentListingSearch,
  propertyTypesForAgentListingQuery,
  syncAgentListingSearchPropertyTypes,
  syncListingTypeFromPropertyTypes,
} from "@/lib/agentListingSearchDefaults";

describe("agent listing search property types", () => {
  it("does not offer Residential Rental for sale or rent", () => {
    const values = AGENT_LISTING_SEARCH_PROPERTY_TYPES.map((type) => type.value);
    expect(values).not.toContain(RESIDENTIAL_RENTAL_PROPERTY_TYPE);
    expect(values).toEqual([
      "single_family",
      "condo",
      "multi_family",
      "townhouse",
      "land",
      "commercial",
    ]);
    expect(defaultPropertyTypesForAgentListingSearch("for_sale")).toEqual([
      "single_family",
      "condo",
    ]);
    expect(defaultPropertyTypesForAgentListingSearch("for_rent")).toEqual([]);
  });

  it("toggles property types without changing sale or rent", () => {
    const sale = { ...initialFilters, listingType: "for_sale" as const, propertyTypes: ["single_family"] };
    const added = syncAgentListingSearchPropertyTypes(sale, "condo", true);
    expect(added.listingType).toBe("for_sale");
    expect(added.propertyTypes).toEqual(["single_family", "condo"]);

    const rent = { ...initialFilters, listingType: "for_rent" as const, propertyTypes: [] };
    const rented = syncAgentListingSearchPropertyTypes(rent, "townhouse", true);
    expect(rented.listingType).toBe("for_rent");
    expect(rented.propertyTypes).toEqual(["townhouse"]);

    const ignored = syncAgentListingSearchPropertyTypes(rent, RESIDENTIAL_RENTAL_PROPERTY_TYPE, true);
    expect(ignored.listingType).toBe("for_rent");
    expect(ignored.propertyTypes).toEqual([]);
  });

  it("drops the legacy rental marker from queries and shared links", () => {
    expect(
      propertyTypesForAgentListingQuery("for_sale", ["single_family", RESIDENTIAL_RENTAL_PROPERTY_TYPE]),
    ).toEqual(["single_family"]);
    expect(
      propertyTypesForAgentListingQuery("for_rent", [RESIDENTIAL_RENTAL_PROPERTY_TYPE]),
    ).toEqual([]);

    const filters = {
      ...initialFilters,
      listingType: "for_sale" as const,
      propertyTypes: ["condo", RESIDENTIAL_RENTAL_PROPERTY_TYPE],
    };
    syncListingTypeFromPropertyTypes(filters);
    expect(filters.listingType).toBe("for_rent");
    expect(filters.propertyTypes).toEqual(["condo"]);

    const params = new URLSearchParams("propertyTypes=residential_rental");
    const fromUrl = { ...initialFilters };
    const propertyTypes = params.get("propertyTypes");
    if (propertyTypes) fromUrl.propertyTypes = propertyTypes.split(",");
    parseAdvancedParams(params, fromUrl);
    expect(fromUrl.listingType).toBe("for_rent");
    expect(fromUrl.propertyTypes).toEqual([]);
  });
});
