/**
 * Browser-side mirror of supabase/functions/_shared/listingPhotoUrl.ts.
 * Rewrites Supabase storage public/render URLs onto the cdn.allagentconnect.com
 * CNAME so every image in client-built emails loads from the AAC domain
 * (matches the From/CTA domain, improving deliverability).
 */

const LISTING_PHOTOS_BUCKET = "listing-photos";
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
  if (/^https?:\/\//i.test(raw)) return rewriteAbsolute(raw);
  const path = raw.replace(/^\/+/, "");
  if (/^storage\/v1\//i.test(path)) return `${CDN_HOST}/${path}`;
  return `${CDN_HOST}/storage/v1/object/public/${LISTING_PHOTOS_BUCKET}/${path}`;
}

export function resolveEmailPhotoUrl(photos: unknown): string {
  if (!Array.isArray(photos) || photos.length === 0) return "";
  const first = photos[0] as unknown;
  let raw = "";
  if (typeof first === "string") {
    raw = first.trim();
  } else if (first && typeof first === "object") {
    const row = first as Record<string, unknown>;
    raw = String(row.url || (row as { publicUrl?: unknown }).publicUrl || (row as { src?: unknown }).src || (row as { image_url?: unknown }).image_url || "").trim();
  }
  return rewriteEmailImageUrl(raw);
}