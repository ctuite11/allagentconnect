import { resolveListingUnitNumber, type ListingAddressUnitSource } from "@/lib/utils";

/** Listing fields used to build email subject address lines. */
export type ListingEmailSubjectSource = ListingAddressUnitSource & {
  property_type?: string | null;
  unit?: string | null;
};

export function isCondoPropertyType(propertyType: string | null | undefined): boolean {
  const t = (propertyType ?? "").toString().trim().toLowerCase().replace(/[\s-]+/g, "_");
  return t === "condo" || t === "condominium";
}

/** Unit for email subjects — condo/condominium only. */
export function resolveListingUnitForSubject(listing: ListingEmailSubjectSource): string | null {
  if (!isCondoPropertyType(listing.property_type)) return null;
  const direct = listing.unit != null ? String(listing.unit).trim() : "";
  if (direct) return direct;
  return resolveListingUnitNumber(listing);
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

/** Street line with condo unit when applicable (no city/state). */
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

/**
 * Address fragment for email subjects: `123 Main St Unit 5B, Boston MA`
 * (condo unit when present; avoids duplicate unit tokens).
 */
export function formatListingEmailSubjectLocation(listing: ListingEmailSubjectSource): string {
  const street = formatListingEmailSubjectStreet(listing);
  const city = (listing.city ?? "").trim();
  const state = (listing.state ?? "").trim();
  const locality = [city, state].filter(Boolean).join(", ");

  if (!street && !locality) return "";
  if (!locality) return street;
  if (!street) return locality;

  if (city && street.toLowerCase().includes(city.toLowerCase())) {
    return street;
  }
  return `${street}, ${locality}`;
}

export function listingEmailSubjectFromRow(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as Record<string, unknown>;
  const location = formatListingEmailSubjectLocation({
    address: typeof r.address === "string" ? r.address : "",
    city: typeof r.city === "string" ? r.city : "",
    state: typeof r.state === "string" ? r.state : "",
    zip_code: typeof r.zip_code === "string" ? r.zip_code : "",
    unit_number: typeof r.unit_number === "string" ? r.unit_number : null,
    condo_details: r.condo_details,
    property_type: typeof r.property_type === "string" ? r.property_type : null,
    unit: typeof r.unit === "string" ? r.unit : null,
  });
  return location ? `Listing: ${location}` : undefined;
}

// NOTE: `buildPropertySharedEmailSubject` ("Property Shared: <address>") was
// removed in Jun 2026 — Gmail filtered that pattern as promotional. Listing
// share now uses the plain `<agent> shared a property with you` subject set
// in supabase/functions/send-listing-share/index.ts.

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

export function buildPersonalListingShareEmailSubject(
  agentFirstName: string,
  listingCount: number,
  primaryListing?: ListingEmailSubjectSource | null,
): string {
  const name = agentFirstName.trim() || "Your agent";
  if (listingCount === 1 && primaryListing) {
    return buildAgentSharedPropertyEmailSubject(name, primaryListing);
  }
  return listingCount === 1
    ? `${name} shared a listing with you`
    : `${name} shared listings with you`;
}

export function buildNewListingSharedEmailSubject(listing: ListingEmailSubjectSource): string {
  const location = formatListingEmailSubjectLocation(listing);
  return location ? `New listing shared: ${location}` : "New listing shared";
}

export function buildOpenHouseEmailSubject(listing: ListingEmailSubjectSource): string {
  const location = formatListingEmailSubjectLocation(listing);
  return location ? `Open house for ${location}` : "Open house scheduled";
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
