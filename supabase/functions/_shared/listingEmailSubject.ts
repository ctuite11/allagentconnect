/** Email subject address lines (mirrors src/lib/listingEmailSubject.ts). */

export type ListingEmailSubjectSource = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  zipCode?: string | null;
  unit_number?: string | null;
  unitNumber?: string | null;
  unit?: string | null;
  condo_details?: unknown;
  property_type?: string | null;
  propertyType?: string | null;
};

function pickUnitFromCondoDetails(details: unknown): string | null {
  if (details == null || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  for (const k of ["unit_number", "unitNumber", "UnitNumber", "unit", "UNIT"] as const) {
    const v = d[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

export function isCondoPropertyType(propertyType: string | null | undefined): boolean {
  const t = (propertyType ?? "").toString().trim().toLowerCase().replace(/[\s-]+/g, "_");
  return t === "condo" || t === "condominium";
}

export function resolveListingUnitForSubject(listing: ListingEmailSubjectSource): string | null {
  if (!isCondoPropertyType(listing.property_type ?? listing.propertyType)) return null;
  const direct = listing.unit != null ? String(listing.unit).trim() : "";
  if (direct) return direct;
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

function normalizeUnitTokenForSubject(unit: string): string {
  const t = unit.trim();
  if (!t) return "";
  if (/^#/.test(t)) return t;
  if (/^(unit|apt\.?|apartment|ste\.?)\b/i.test(t)) return t;
  return `Unit ${t}`;
}

function streetAlreadyHasUnit(street: string, unit: string): boolean {
  const bare = unit.replace(/^#/, "").trim();
  if (!bare) return false;
  const esc = bare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`#\\s*${esc}\\b`, "i").test(street) ||
    new RegExp(`\\b(?:Unit|Apt\\.?|Apartment|Ste\\.?)\\s*${esc}\\b`, "i").test(street)
  );
}

export function formatListingEmailSubjectStreet(listing: ListingEmailSubjectSource): string {
  let street = (listing.address ?? "").trim().replace(/\s*,?\s*(USA|United States)$/i, "");
  const unit = resolveListingUnitForSubject(listing);
  if (unit) {
    const token = normalizeUnitTokenForSubject(unit);
    if (token && !streetAlreadyHasUnit(street, unit) && !streetAlreadyHasUnit(street, token)) {
      street = `${street} ${token}`.replace(/\s+/g, " ").trim();
    }
  }
  return street;
}

export function formatListingEmailSubjectLocation(listing: ListingEmailSubjectSource): string {
  const street = formatListingEmailSubjectStreet(listing);
  const city = (listing.city ?? "").trim();
  const state = (listing.state ?? "").trim();
  const locality = [city, state].filter(Boolean).join(", ");

  if (!street && !locality) return "";
  if (!locality) return street;
  if (!street) return locality;
  if (city && street.toLowerCase().includes(city.toLowerCase())) return street;
  return `${street}, ${locality}`;
}

export function buildPropertySharedEmailSubject(listing: ListingEmailSubjectSource): string {
  const location = formatListingEmailSubjectLocation(listing);
  return location ? `Property Shared: ${location}` : "Property Shared";
}

export function buildAgentSharedPropertyEmailSubject(
  agentName: string,
  listing: ListingEmailSubjectSource,
): string {
  const name = agentName.trim() || "Your agent";
  const location = formatListingEmailSubjectLocation(listing);
  return location ? `${name} shared a property: ${location}` : `${name} shared a property with you`;
}

export function buildBulkListingShareEmailSubject(
  agentName: string,
  listings: ListingEmailSubjectSource[],
): string {
  const name = agentName.trim() || "Your agent";
  if (listings.length === 1) {
    return buildAgentSharedPropertyEmailSubject(name, listings[0]!);
  }
  return `${name} shared ${listings.length} property listings with you`;
}

export function buildListingInquiryEmailSubject(listing: ListingEmailSubjectSource): string {
  const location = formatListingEmailSubjectLocation(listing);
  return location ? `New inquiry about ${location}` : "New listing inquiry";
}

export function buildShowingRequestEmailSubject(listing: ListingEmailSubjectSource): string {
  const location = formatListingEmailSubjectLocation(listing);
  return location ? `New showing request for ${location}` : "New showing request";
}

export function buildPropertyMatchEmailSubject(listing: ListingEmailSubjectSource): string {
  const location = formatListingEmailSubjectLocation(listing);
  return location ? `New Property Match: ${location}` : "New Property Match";
}
