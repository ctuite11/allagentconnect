import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert string to Title Case
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * USPS-style terminal street suffixes for listing card display.
 * Keys are lowercase tokens (periods stripped). Values are canonical abbreviations.
 * "Way" stays "Way" per AAC display standard.
 */
const DISPLAY_STREET_SUFFIX_ABBREV: Readonly<Record<string, string>> = {
  street: "St",
  st: "St",
  avenue: "Ave",
  ave: "Ave",
  road: "Rd",
  rd: "Rd",
  boulevard: "Blvd",
  blvd: "Blvd",
  lane: "Ln",
  ln: "Ln",
  drive: "Dr",
  dr: "Dr",
  court: "Ct",
  ct: "Ct",
  place: "Pl",
  pl: "Pl",
  terrace: "Ter",
  ter: "Ter",
  circle: "Cir",
  cir: "Cir",
  way: "Way",
};

/** Normalize only the last street token (avoids "Courtney" → "Ctney" etc.). */
function abbreviateTerminalStreetSuffixOnSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return segment;

  const unitSuffixMatch = trimmed.match(/(\s+#\S[\s\S]*)$/);
  const unitSuffix = unitSuffixMatch?.[1] ?? "";
  const streetCore = unitSuffix ? trimmed.slice(0, -unitSuffix.length).trimEnd() : trimmed;

  const tokens = streetCore.split(/\s+/);
  if (tokens.length === 0) return segment;

  const lastIdx = tokens.length - 1;
  const bare = tokens[lastIdx].replace(/\./g, "").toLowerCase();
  const canonical = DISPLAY_STREET_SUFFIX_ABBREV[bare];
  if (canonical) {
    tokens[lastIdx] = canonical;
    return tokens.join(" ") + unitSuffix;
  }
  return segment;
}

/** Abbreviate suffixes on the street portion only (before `, City`). */
function applyDisplayStreetSuffixAbbreviation(addressLine: string, city: string): string {
  const cityTrim = (city || "").trim();
  if (!cityTrim) {
    return abbreviateTerminalStreetSuffixOnSegment(addressLine);
  }

  const marker = `, ${cityTrim}`;
  const idx = addressLine.toLowerCase().indexOf(marker.toLowerCase());
  if (idx === -1) {
    return abbreviateTerminalStreetSuffixOnSegment(addressLine);
  }

  const street = abbreviateTerminalStreetSuffixOnSegment(addressLine.slice(0, idx));
  return street + addressLine.slice(idx);
}

/** Minimal listing slice for formatting street + MLS unit (column or condo_details). */
export type ListingAddressUnitSource = {
  address: string;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  unit_number?: string | null;
  condo_details?: unknown;
};

/** Common MLS / vendor keys for condo unit inside `condo_details` JSON. */
function pickUnitFromCondoDetails(details: unknown): string | null {
  if (details == null || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  for (const k of ["unit_number", "unitNumber", "UnitNumber", "unit", "UNIT"] as const) {
    const v = d[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

export function resolveListingUnitNumber(listing: ListingAddressUnitSource): string | null {
  const top = listing.unit_number;
  if (top != null && String(top).trim() !== "") return String(top).trim();
  if (!listing.condo_details) return null;
  try {
    const details =
      typeof listing.condo_details === "string"
        ? JSON.parse(listing.condo_details as string)
        : listing.condo_details;
    return pickUnitFromCondoDetails(details);
  } catch {
    return null;
  }
}

export function buildDisplayAddress(listing: ListingAddressUnitSource) {
  const city = listing.city || '';
  const state = listing.state || '';
  const zip = listing.zip_code || '';

  const removeCountry = (s: string) =>
    s.replace(/\s*,?\s*(USA|United States)$/i, '');

  let base = (listing.address || '').trim();
  base = removeCountry(base);

  const unit = resolveListingUnitNumber(listing);

  if (unit) {
    const esc = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasHash = new RegExp(`#\\s*${esc}\\b`, "i").test(base);
    /** Match MLS-style unit tokens (not only "Unit …") so we still append `#` when appropriate. */
    const hasMlsUnitToken = new RegExp(
      `\\b(?:Unit|Apt\\.?|Apartment|Ste\\.?)\\s*${esc}\\b`,
      "i",
    ).test(base);
    if (!hasHash && !hasMlsUnitToken) {
      const cityIndex = city ? base.indexOf(`, ${city}`) : -1;
      if (cityIndex > -1) {
        base = `${base.slice(0, cityIndex)} #${unit}${base.slice(cityIndex)}`;
      } else {
        base = `${base} #${unit}`;
      }
    }
  }

  // Check if city/state/zip are already in the address
  const lowerBase = base.toLowerCase();
  const hasCity = city && lowerBase.includes(city.toLowerCase());
  const hasState = state && new RegExp(`\\b${state}\\b`, 'i').test(base);
  const hasZip = zip && base.includes(zip);

  // Build the final address, avoiding duplicate city/state/zip
  // If address already contains city, just ensure state and zip are present
  if (hasCity && hasState && hasZip) {
    // All present, just convert to title case
    return toTitleCase(base);
  }
  
  // If address has city but not full location, append missing parts
  if (hasCity) {
    // City is there, check if we need state/zip
    if (!hasState || !hasZip) {
      // Replace the city part with full city, state zip
      const cityRegex = new RegExp(`(${city})(?:,?\\s*)?`, 'i');
      base = base.replace(cityRegex, `$1, ${state} ${zip}`);
    }
  } else {
    // No city in address, append full location
    const tail = `${city}, ${state} ${zip}`;
    base = `${base}, ${tail}`;
  }

  base = applyDisplayStreetSuffixAbbreviation(base, city);

  // Convert to Title Case before returning
  return toTitleCase(base);
}

/**
 * First line for split card layouts (grid / list shell): street + unit, no city/state/zip.
 * Keeps unit injection in sync with {@link buildDisplayAddress}.
 */
export function listingCardStreetHeading(listing: ListingAddressUnitSource): string {
  const full = buildDisplayAddress(listing);
  const city = (listing.city || "").trim();
  const state = (listing.state || "").trim();
  const zip = (listing.zip_code || "").trim();
  if (!city) return full;

  const fullLower = full.toLowerCase();
  const candidates: string[] = [];
  if (zip) {
    candidates.push(`, ${city}, ${state} ${zip}`);
    const zip5 = zip.split("-")[0]?.trim();
    if (zip5 && zip5 !== zip) candidates.push(`, ${city}, ${state} ${zip5}`);
  }
  candidates.push(`, ${city}, ${state}`);

  for (const tail of candidates) {
    if (fullLower.endsWith(tail.toLowerCase())) {
      return full.slice(0, full.length - tail.length).trim();
    }
  }
  return full;
}

/**
 * Convert human-readable property type to database enum format
 */
export function propertyTypeToEnum(displayType: string): string {
  const mapping: Record<string, string> = {
    "Single Family": "single_family",
    "Single-Family": "single_family",
    "Condo": "condo",
    "Condominium": "condo",
    "Townhouse": "townhouse",
    "Multi Family": "multi_family",
    "Multi-Family": "multi_family",
    "Land": "land",
    "Commercial": "commercial",
    "Residential Rental": "residential_rental",
    "Commercial Rental": "commercial_rental",
  };
  return mapping[displayType] || displayType.toLowerCase().replace(/\s+/g, '_');
}
