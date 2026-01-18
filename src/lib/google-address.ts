type AddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type LegacyGooglePlace = {
  formatted_address?: string;
  address_components?: AddressComponent[];
  name?: string;
};

type MappedPlace = {
  formatted_address?: string;
  address_components?: AddressComponent[];
  geometry?: any;
  name?: string;
};

type AnyPlace = LegacyGooglePlace | MappedPlace;

export type NormalizedAddress = {
  formatted_address?: string;
  address_line1: string;      // "28 Atlantic Ave"
  unit_number?: string;       // "Unit 3B" (optional)
  city: string;
  state: string;              // "MA"
  zip: string;                // "02110"
  street_number?: string;
  route?: string;
  neighborhood?: string;      // optional (often unreliable from Google)
  lat?: number;
  lng?: number;
};

function pick(components: AddressComponent[] | undefined, type: string) {
  if (!components) return undefined;
  return components.find(c => c.types?.includes(type));
}

function getLong(components: AddressComponent[] | undefined, type: string) {
  return pick(components, type)?.long_name;
}

function getShort(components: AddressComponent[] | undefined, type: string) {
  return pick(components, type)?.short_name;
}

/**
 * Normalize Google place output into consistent address fields.
 * Works with both legacy Places Autocomplete and mapped PlaceAutocompleteElement payload.
 */
export function normalizeGooglePlace(place: AnyPlace): NormalizedAddress {
  const components = (place as any).address_components as AddressComponent[] | undefined;

  const street_number = getLong(components, "street_number") || "";
  const route = getLong(components, "route") || "";

  // City can be "locality" OR "sublocality_level_1" depending on address
  const city =
    getLong(components, "locality") ||
    getLong(components, "sublocality_level_1") ||
    getLong(components, "postal_town") || // some regions
    "";

  const state = getShort(components, "administrative_area_level_1") || "";
  const zip = getLong(components, "postal_code") || "";

  // Neighborhood is often inconsistent; keep optional
  const neighborhood =
    getLong(components, "neighborhood") ||
    getLong(components, "sublocality") ||
    getLong(components, "sublocality_level_1") ||
    undefined;

  const address_line1 = [street_number, route].filter(Boolean).join(" ").trim();

  // Lat/Lng (optional; depends on payload shape)
  let lat: number | undefined;
  let lng: number | undefined;

  // Legacy: place.geometry.location.lat()
  const legacyLoc = (place as any).geometry?.location;
  if (legacyLoc) {
    try {
      lat = typeof legacyLoc.lat === "function" ? legacyLoc.lat() : legacyLoc.lat;
      lng = typeof legacyLoc.lng === "function" ? legacyLoc.lng() : legacyLoc.lng;
    } catch {
      // ignore
    }
  }

  return {
    formatted_address: (place as any).formatted_address,
    address_line1,
    city,
    state,
    zip,
    street_number: street_number || undefined,
    route: route || undefined,
    neighborhood,
    lat,
    lng,
  };
}

/**
 * Check if minimum address fields are present for matching.
 */
export function hasMinimumAddress(a: { address?: string; city?: string; state?: string }) {
  return Boolean(a.address && a.city && a.state);
}
