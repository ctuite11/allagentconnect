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

export function buildDisplayAddress(
  listing: { address: string; city: string; state: string; zip_code: string; condo_details?: any }
) {
  const city = listing.city || '';
  const state = listing.state || '';
  const zip = listing.zip_code || '';

  const removeCountry = (s: string) =>
    s.replace(/\s*,?\s*(USA|United States)$/i, '');

  let base = (listing.address || '').trim();
  base = removeCountry(base);

  // Get unit number from condo_details
  let unit: string | null = null;
  try {
    const details =
      typeof listing.condo_details === 'string'
        ? JSON.parse(listing.condo_details)
        : listing.condo_details;
    unit = details?.unit_number ? String(details.unit_number) : null;
  } catch {
    unit = null;
  }

  if (unit) {
    const hasHash = new RegExp(`#\\s*${unit}\\b`, 'i').test(base);
    const hasWord = new RegExp(`\\bUnit\\s*${unit}\\b`, 'i').test(base);
    if (!hasHash && !hasWord) {
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

  // Convert to Title Case before returning
  return toTitleCase(base);
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
