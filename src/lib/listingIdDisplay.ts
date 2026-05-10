/**
 * AAC-native listing reference for cards (`ID# L-1234`).
 * Never emits MLS labeling or terminology in UI copy.
 */
export function formatListingIdLabel(listing: { listing_number?: string | null }): string | null {
  const raw = listing.listing_number;
  if (raw == null || String(raw).trim() === "") return null;
  const tail = String(raw).trim().replace(/^L-/i, "").trim();
  if (tail === "") return null;
  return `ID# L-${tail}`;
}

/**
 * Inline listing-ID control — always AAC blue (`#0E56F5`) on every card/surface for consistency.
 * Hover darkens slightly; focus ring is neutral (no blue glow).
 */
export const LISTING_ID_NAV_CLASS =
  "inline p-0 m-0 bg-transparent border-0 shadow-none rounded-none font-inherit " +
  "text-[#0E56F5] cursor-pointer hover:text-[#0B46CC] hover:underline " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-1";

/** @deprecated Alias of `LISTING_ID_NAV_CLASS` — same AAC blue everywhere (search, hub, grids). */
export const LISTING_ID_NAV_CLASS_SEARCH_SURFACE = LISTING_ID_NAV_CLASS;
