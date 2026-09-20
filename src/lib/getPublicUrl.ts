import { DCMLS_BRAND } from "@/lib/branding";
import { isDcmlsHost, isLiveDcmlsHost } from "@/lib/host";

/**
 * Returns the production-ready public URL for sharing.
 * Uses VITE_PUBLIC_URL env var if available, otherwise falls back to current origin.
 */
export const getPublicOrigin = (): string => {
  return import.meta.env.VITE_PUBLIC_URL || window.location.origin;
};

/** Origin for DCMLS consumer share/canonical URLs. */
function getDcmlsPublicOrigin(): string {
  if (typeof window === "undefined") return DCMLS_BRAND.siteUrl;
  // Live DCMLS host — use current origin (handles www vs apex).
  if (isLiveDcmlsHost()) return window.location.origin;
  // Preview / localhost with ?dcmls=1 — stay on current origin so Share is testable.
  return window.location.origin;
}

/** Path (+ optional preview query) for a DCMLS consumer property page. */
function getDcmlsListingPath(listingId: string): string {
  const path = `/consumer-property/${listingId}`;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("dcmls") === "1") return `${path}?dcmls=1`;
  }
  return path;
}

/**
 * Returns the full public URL for a property listing.
 * DCMLS host → /consumer-property/:id (listing-agent-first).
 * AAC → /property/:id (unchanged).
 */
export const getListingPublicUrl = (listingId: string): string => {
  if (isDcmlsHost()) {
    return `${getDcmlsPublicOrigin()}${getDcmlsListingPath(listingId)}`;
  }
  return `${getPublicOrigin()}/property/${listingId}`;
};

/**
 * Returns the share URL for a property listing.
 * Points directly to the property page so social crawlers can read OG metadata.
 * DCMLS host → /consumer-property/:id; AAC → /property/:id.
 */
export const getListingShareUrl = (listingId: string): string => {
  if (isDcmlsHost()) {
    return `${getDcmlsPublicOrigin()}${getDcmlsListingPath(listingId)}`;
  }
  return `${getPublicOrigin()}/property/${listingId}`;
};

/** Agent hot sheet review page — shareable link for personal (My Hot Sheets) results. */
export const getHotSheetReviewShareUrl = (hotSheetId: string): string => {
  return `${getPublicOrigin()}/hot-sheets/${hotSheetId}/review`;
};
