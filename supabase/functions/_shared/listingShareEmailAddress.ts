/** Street + unit line for listing-share email cards (mirrors src/lib/utils listing address helpers). */

export type ListingEmailAddressSource = {
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  zipCode?: string;
  unit_number?: string | null;
  unitNumber?: string | null;
  condo_details?: unknown;
};

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Title casing lowercases two-letter state codes ("MA" -> "Ma").
 * Restore uppercase for the state token that sits between the city comma and
 * the ZIP code (e.g. ", Ma 02127" -> ", MA 02127").
 */
function upperCaseStateToken(formatted: string, state: string): string {
  const code = (state || "").trim();
  let out = formatted;
  if (code.length === 2) {
    out = out.replace(
      new RegExp(`(,\\s*)${code}(?=\\b)`, "gi"),
      (_m, sep: string) => `${sep}${code.toUpperCase()}`,
    );
  }
  // Generic safety net: any ", Xx 12345" tail becomes ", XX 12345".
  return out.replace(
    /(,\s*)([A-Za-z]{2})(\s+\d{5}(?:-\d{4})?)\b/g,
    (_m, sep: string, st: string, zip: string) => `${sep}${st.toUpperCase()}${zip}`,
  );
}

function pickUnitFromCondoDetails(details: unknown): string | null {
  if (details == null || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  for (const k of ["unit_number", "unitNumber", "UnitNumber", "unit", "UNIT"] as const) {
    const v = d[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function resolveListingUnitNumber(listing: ListingEmailAddressSource): string | null {
  const top = listing.unit_number ?? listing.unitNumber;
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

function buildDisplayAddress(listing: ListingEmailAddressSource): string {
  const city = (listing.city || "").trim();
  const state = (listing.state || "").trim();
  const zip = (listing.zip_code || listing.zipCode || "").trim();

  const removeCountry = (s: string) => s.replace(/\s*,?\s*(USA|United States)$/i, "");

  let base = removeCountry((listing.address || "").trim());
  const unit = resolveListingUnitNumber(listing);

  if (unit) {
    const esc = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasHash = new RegExp(`#\\s*${esc}\\b`, "i").test(base);
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

  const lowerBase = base.toLowerCase();
  const hasCity = city && lowerBase.includes(city.toLowerCase());
  const hasState = state && new RegExp(`\\b${state}\\b`, "i").test(base);
  const hasZip = zip && base.includes(zip);

  if (hasCity && hasState && hasZip) {
    return upperCaseStateToken(toTitleCase(base), state);
  }

  if (hasCity) {
    if (!hasState || !hasZip) {
      const cityRegex = new RegExp(`(${city})(?:,?\\s*)?`, "i");
      base = base.replace(cityRegex, `$1, ${state} ${zip}`);
    }
  } else {
    const tail = `${city}, ${state} ${zip}`;
    base = `${base}, ${tail}`;
  }

  return upperCaseStateToken(toTitleCase(base), state);
}

/** Full formatted address (street + unit + city/state/zip) for compact listing cards. */
export function formatListingShareEmailFullAddress(listing: ListingEmailAddressSource): string {
  return buildDisplayAddress(listing);
}

/** Street + unit only (no city/state/zip) for email card address lines. */
export function formatListingShareEmailStreetLine(listing: ListingEmailAddressSource): string {
  const full = buildDisplayAddress(listing);
  const city = (listing.city || "").trim();
  const state = (listing.state || "").trim();
  const zip = (listing.zip_code || listing.zipCode || "").trim();
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
