/**
 * Shared MLS / internal listing ID label for cards (AAC vs DCMLS).
 */
export function formatListingIdLabel(listing: {
  listing_number?: string | null;
  publish_to_dcmls?: boolean | null;
}): string | null {
  const raw = listing.listing_number;
  if (raw == null || String(raw).trim() === "") return null;
  const trimmed = String(raw).trim();
  if (listing.publish_to_dcmls === true) {
    return `MLS# ${trimmed}`;
  }
  const tail = trimmed.replace(/^L-/i, "").trim();
  return `ID# L-${tail}`;
}

/** Tailwind classes for inline listing-ID navigation (matches AAC blue link pattern). */
export const LISTING_ID_NAV_CLASS =
  "inline p-0 m-0 bg-transparent border-0 shadow-none rounded-none font-inherit text-[#0E56F5] cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
