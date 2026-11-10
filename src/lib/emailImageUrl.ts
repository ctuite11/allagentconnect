/**
 * Browser-side mirror of supabase/functions/_shared/listingPhotoUrl.ts.
 * Confidential property media becomes a neutral email image. Public branding
 * can keep its normal CDN URL; buyers open a secure page for property photos.
 */

const CDN_HOST = "https://cdn.allagentconnect.com";

function rewriteAbsolute(url: string): string {
  const m = url.match(/^https?:\/\/[^/]+(\/storage\/v1\/(?:object|render\/image)\/public\/.*)$/i);
  if (!m) return url;
  return `${CDN_HOST}${m[1]}`;
}

export function rewriteEmailImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw) || /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/(?:listing-photos|listing-floorplans|agent-match-photos|email-attachments)\//i.test(raw)) {
    return "https://allagentconnect.com/og/aac-og-2026-01-22.jpg";
  }
  return rewriteAbsolute(raw);
}

export function resolveEmailPhotoUrl(photos: unknown): string {
  return photos && (!Array.isArray(photos) || photos.length > 0)
    ? "https://allagentconnect.com/og/aac-og-2026-01-22.jpg" : "";
}
