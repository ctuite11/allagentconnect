/**
 * Returns the production-ready public URL for sharing.
 * Uses VITE_PUBLIC_URL env var if available, otherwise falls back to current origin.
 */
export const getPublicOrigin = (): string => {
  return import.meta.env.VITE_PUBLIC_URL || window.location.origin;
};

/**
 * Returns the full public URL for a property listing.
 */
export const getListingPublicUrl = (listingId: string): string => {
  return `${getPublicOrigin()}/property/${listingId}`;
};

/**
 * Returns the share URL for a property listing.
 * Uses the canonical /property/ path. The Netlify Edge Function
 * intercepts crawler requests to serve OG metadata, while regular
 * users are passed through to the SPA.
 */
export const getListingShareUrl = (listingId: string): string => {
  return `${getPublicOrigin()}/property/${listingId}`;
};
