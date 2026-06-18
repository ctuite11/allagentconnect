const LISTING_PHOTOS_BUCKET = "listing-photos";
const CDN_HOST = "https://cdn.allagentconnect.com";

/** Rewrite Supabase storage public/render URLs onto the cdn.allagentconnect.com CNAME. */
function rewriteToCdn(url: string): string {
  if (!url) return url;
  const m = url.match(/^https?:\/\/[^/]+(\/storage\/v1\/(?:object|render\/image)\/public\/.*)$/i);
  if (!m) return url;
  return `${CDN_HOST}${m[1]}`;
}

/**
 * Public helper: rewrite any single image URL to the AAC CDN host when it
 * resolves to a Supabase storage public/render path. Safe to call with
 * absolute URLs, relative paths (leading slash optional), or empty strings.
 */
export function rewriteEmailImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return rewriteToCdn(raw);
  // Relative storage path → absolute CDN URL. Tolerate leading slash and
  // already-prefixed "/storage/v1/..." inputs.
  const path = raw.replace(/^\/+/, "");
  if (/^storage\/v1\//i.test(path)) return `${CDN_HOST}/${path}`;
  return `${CDN_HOST}/storage/v1/object/public/${LISTING_PHOTOS_BUCKET}/${path}`;
}

/**
 * Public helper: resolve the first photo from a JSON/array/string `photos`
 * field to a CDN-hosted public URL suitable for an email <img src>.
 * Returns "" when no photo is available.
 */
export function resolveEmailPhotoUrl(photos: unknown): string {
  const first = extractFirstPhoto(photos);
  if (!first) return "";
  let raw = "";
  if (typeof first === "string") {
    raw = first.trim();
  } else if (first && typeof first === "object") {
    const row = first as Record<string, unknown>;
    raw = String(row.url || row.publicUrl || row.src || row.image_url || "").trim();
  }
  return rewriteEmailImageUrl(raw);
}

/** Resolve the first listing photo to a public HTTPS URL (handles storage paths). */
export function resolveListingPhotoUrl(photos: unknown, supabaseUrl: string): string {
  const first = extractFirstPhoto(photos);
  if (!first) return "";

  let raw = "";
  if (typeof first === "string") {
    raw = first.trim();
  } else if (first && typeof first === "object") {
    const row = first as Record<string, unknown>;
    raw = String(row.url || row.publicUrl || row.src || row.image_url || "").trim();
  }

  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return rewriteToCdn(raw);

  const path = raw.replace(/^\//, "");
  return `${CDN_HOST}/storage/v1/object/public/${LISTING_PHOTOS_BUCKET}/${path}`;
}

function extractFirstPhoto(photos: unknown): unknown {
  if (photos == null) return null;

  if (Array.isArray(photos)) {
    return photos.length > 0 ? photos[0] : null;
  }

  if (typeof photos === "string") {
    const trimmed = photos.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  return null;
}

export const LISTING_OG_PLACEHOLDER =
  "https://allagentconnect.com/og/aac-og-2026-01-22.jpg";

/**
 * Convert a public listing-photos URL into a Supabase Storage
 * Image Transformation URL sized for Open Graph crawlers (1200x630,
 * ~80 quality JPEG). Falls back to the input URL when it does not look
 * like a listing-photos public URL.
 */
export function toOgImageUrl(publicUrl: string): string {
  if (!publicUrl) return publicUrl;
  const marker = "/storage/v1/object/public/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return publicUrl;
  const rest = publicUrl.slice(idx + marker.length); // "<bucket>/<path>"
  const params = "width=1200&height=630&resize=cover&quality=80&format=origin";
  return `${CDN_HOST}/storage/v1/render/image/public/${rest}?${params}`;
}
