import type { FilterState } from "@/components/listing-search/ListingSearchFilters";

/**
 * Builds URLSearchParams from FilterState. Used by both search page and navigation handlers.
 */
export function buildSearchParams(f: FilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (f.listingType && f.listingType !== "for_sale") params.set("lt", f.listingType);
  if (f.propertyTypes.length > 0) params.set("propertyTypes", f.propertyTypes.join(","));
  if (f.statuses.length > 0) params.set("statuses", f.statuses.join(","));
  if (f.selectedTowns.length > 0) params.set("towns", f.selectedTowns.join(","));
  if (f.priceMin) params.set("priceMin", f.priceMin);
  if (f.priceMax) params.set("priceMax", f.priceMax);
  if (f.bedsMin) params.set("bedsMin", f.bedsMin);
  if (f.bedsMax) params.set("bedsMax", f.bedsMax);
  if (f.bathsMin) params.set("bathsMin", f.bathsMin);
  if (f.bathsMax) params.set("bathsMax", f.bathsMax);
  if (f.sqftMin) params.set("sqftMin", f.sqftMin);
  if (f.sqftMax) params.set("sqftMax", f.sqftMax);
  if (f.lotSizeMin) params.set("lotSizeMin", f.lotSizeMin);
  if (f.lotSizeMax) params.set("lotSizeMax", f.lotSizeMax);
  if (f.yearBuiltMin) params.set("yearBuiltMin", f.yearBuiltMin);
  if (f.yearBuiltMax) params.set("yearBuiltMax", f.yearBuiltMax);
  if (f.garageSpaces) params.set("garageSpaces", f.garageSpaces);
  if (f.parkingSpaces) params.set("parkingSpaces", f.parkingSpaces);
  if (f.state && f.state !== "MA") params.set("state", f.state);
  if (f.county) params.set("county", f.county);
  if (f.streetNumber) params.set("streetNumber", f.streetNumber);
  if (f.streetName) params.set("streetName", f.streetName);
  if (f.zipCode) params.set("zipCode", f.zipCode);
  if (f.radius) params.set("radius", f.radius);
  if (f.radiusUnit && f.radiusUnit !== "miles") params.set("radiusUnit", f.radiusUnit);
  if (f.originLat) params.set("originLat", f.originLat);
  if (f.originLng) params.set("originLng", f.originLng);
  if (f.locationMode && f.locationMode !== "street") params.set("locationMode", f.locationMode);
  if (f.keywordsInclude) params.set("keywordsInclude", f.keywordsInclude);
  if (f.keywordsExclude) params.set("keywordsExclude", f.keywordsExclude);
  if (f.keywordMode && f.keywordMode !== "any") params.set("keywordMode", f.keywordMode);
  if (f.listingNumber) params.set("listingNumber", f.listingNumber);
  if (f.openHouses) params.set("openHouses", "true");
  if (f.brokerTours) params.set("brokerTours", "true");
  if (f.listingEventsTimeframe) params.set("listingEventsTimeframe", f.listingEventsTimeframe);
  if (f.listDateFrom) params.set("listDateFrom", f.listDateFrom);
  if (f.listDateTo) params.set("listDateTo", f.listDateTo);
  // rooms — no DB column exists yet; preserved in URL for future use
  if (f.rooms) params.set("rooms", f.rooms);
  // acres — no native DB column; preserved in URL for future use
  if (f.acres) params.set("acres", f.acres);
  // pricePerSqFt — derived value, no raw column; preserved in URL for future use
  if (f.pricePerSqFt) params.set("pricePerSqFt", f.pricePerSqFt);
  if (f.pricePerSqFtMin) params.set("pricePerSqFtMin", f.pricePerSqFtMin);

  return params;
}

/**
 * Parses URL search params back into FilterState for advanced/radius/location fields.
 */
export function parseAdvancedParams(searchParams: URLSearchParams, f: FilterState): void {
  // Listing type (sale vs rent)
  const lt = searchParams.get("lt");
  if (lt === "for_rent" || lt === "for_sale") f.listingType = lt;

  // Radius & location
  if (searchParams.get("radius")) f.radius = searchParams.get("radius") || "";
  if (searchParams.get("radiusUnit")) f.radiusUnit = (searchParams.get("radiusUnit") as "miles" | "km") || "miles";
  if (searchParams.get("originLat")) f.originLat = searchParams.get("originLat") || "";
  if (searchParams.get("originLng")) f.originLng = searchParams.get("originLng") || "";
  if (searchParams.get("locationMode")) f.locationMode = (searchParams.get("locationMode") as "street" | "location") || "street";

  // Advanced numeric ranges
  if (searchParams.get("bedsMax")) f.bedsMax = searchParams.get("bedsMax") || "";
  if (searchParams.get("bathsMax")) f.bathsMax = searchParams.get("bathsMax") || "";
  if (searchParams.get("sqftMin")) f.sqftMin = searchParams.get("sqftMin") || "";
  if (searchParams.get("sqftMax")) f.sqftMax = searchParams.get("sqftMax") || "";
  if (searchParams.get("lotSizeMin")) f.lotSizeMin = searchParams.get("lotSizeMin") || "";
  if (searchParams.get("lotSizeMax")) f.lotSizeMax = searchParams.get("lotSizeMax") || "";
  if (searchParams.get("yearBuiltMin")) f.yearBuiltMin = searchParams.get("yearBuiltMin") || "";
  if (searchParams.get("yearBuiltMax")) f.yearBuiltMax = searchParams.get("yearBuiltMax") || "";
  if (searchParams.get("garageSpaces")) f.garageSpaces = searchParams.get("garageSpaces") || "";
  if (searchParams.get("parkingSpaces")) f.parkingSpaces = searchParams.get("parkingSpaces") || "";

  // Keywords
  if (searchParams.get("keywordsInclude")) f.keywordsInclude = searchParams.get("keywordsInclude") || "";
  if (searchParams.get("keywordsExclude")) f.keywordsExclude = searchParams.get("keywordsExclude") || "";
  if (searchParams.get("keywordMode")) f.keywordMode = (searchParams.get("keywordMode") as "any" | "all") || "any";

  // Listing number & events
  if (searchParams.get("listingNumber")) f.listingNumber = searchParams.get("listingNumber") || "";
  if (searchParams.get("openHouses")) f.openHouses = searchParams.get("openHouses") === "true";
  if (searchParams.get("brokerTours")) f.brokerTours = searchParams.get("brokerTours") === "true";
  if (searchParams.get("listingEventsTimeframe")) f.listingEventsTimeframe = searchParams.get("listingEventsTimeframe") || "";

  // Date range
  if (searchParams.get("listDateFrom")) f.listDateFrom = searchParams.get("listDateFrom") || "";
  if (searchParams.get("listDateTo")) f.listDateTo = searchParams.get("listDateTo") || "";

  // Future fields (no DB column yet — preserved for URL round-trip)
  if (searchParams.get("rooms")) f.rooms = searchParams.get("rooms") || "";
  if (searchParams.get("acres")) f.acres = searchParams.get("acres") || "";
  if (searchParams.get("pricePerSqFt")) f.pricePerSqFt = searchParams.get("pricePerSqFt") || "";
  if (searchParams.get("pricePerSqFtMin")) f.pricePerSqFtMin = searchParams.get("pricePerSqFtMin") || "";
}

/**
 * @deprecated Use parseAdvancedParams instead
 */
export const parseRadiusParams = parseAdvancedParams;
