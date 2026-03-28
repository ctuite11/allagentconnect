import type { FilterState } from "@/components/listing-search/ListingSearchFilters";

/**
 * Builds URLSearchParams from FilterState. Used by both search page and navigation handlers.
 */
export function buildSearchParams(f: FilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (f.propertyTypes.length > 0) params.set("propertyTypes", f.propertyTypes.join(","));
  if (f.statuses.length > 0) params.set("statuses", f.statuses.join(","));
  if (f.selectedTowns.length > 0) params.set("towns", f.selectedTowns.join(","));
  if (f.priceMin) params.set("priceMin", f.priceMin);
  if (f.priceMax) params.set("priceMax", f.priceMax);
  if (f.bedsMin) params.set("bedsMin", f.bedsMin);
  if (f.bathsMin) params.set("bathsMin", f.bathsMin);
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

  return params;
}

/**
 * Parses URL search params back into partial FilterState fields for radius/location.
 */
export function parseRadiusParams(searchParams: URLSearchParams, urlFilters: FilterState): void {
  if (searchParams.get("radius")) urlFilters.radius = searchParams.get("radius") || "";
  if (searchParams.get("radiusUnit")) urlFilters.radiusUnit = (searchParams.get("radiusUnit") as "miles" | "km") || "miles";
  if (searchParams.get("originLat")) urlFilters.originLat = searchParams.get("originLat") || "";
  if (searchParams.get("originLng")) urlFilters.originLng = searchParams.get("originLng") || "";
  if (searchParams.get("locationMode")) urlFilters.locationMode = (searchParams.get("locationMode") as "street" | "location") || "street";
}
