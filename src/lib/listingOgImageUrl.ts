/** Public Supabase edge function URL for composed listing OG images (1200×630 JPEG). */
export function getListingOgImageUrl(listingId: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  if (!base || !listingId) {
    return "https://allagentconnect.com/og/aac-og-2026-01-22.jpg";
  }
  return `${base}/functions/v1/listing-og-image?id=${encodeURIComponent(listingId)}`;
}
