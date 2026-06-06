const LISTING_PHOTOS_BUCKET = "listing-photos";

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
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = supabaseUrl.replace(/\/$/, "");
  const path = raw.replace(/^\//, "");
  return `${base}/storage/v1/object/public/${LISTING_PHOTOS_BUCKET}/${path}`;
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
