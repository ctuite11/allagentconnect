import { supabase } from "@/integrations/supabase/client";

/**
 * Display-only AAC listing cover when no usable photo exists.
 * Never write this into listing.photos / DB — display fallback only.
 */
export const LISTING_PHOTO_PLACEHOLDER = "/listing-placeholder.svg";

export function resolveListingPhotoUrl(photo: unknown): string | undefined {
  if (typeof photo === "string") {
    const trimmed = photo.trim();
    if (!trimmed || trimmed === LISTING_PHOTO_PLACEHOLDER || trimmed === "/placeholder.svg") {
      return undefined;
    }
    return trimmed;
  }
  if (photo && typeof photo === "object") {
    const record = photo as Record<string, unknown>;
    const raw = record.url ?? record.publicUrl;
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    if (raw === LISTING_PHOTO_PLACEHOLDER || raw === "/placeholder.svg") return undefined;
    if (raw.startsWith("http")) return raw;
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(raw);
    return data.publicUrl || undefined;
  }
  return undefined;
}

export function resolveFirstListingPhotoUrl(photos: unknown): string | undefined {
  if (!Array.isArray(photos) || photos.length === 0) return undefined;
  for (const photo of photos) {
    const url = resolveListingPhotoUrl(photo);
    if (url) return url;
  }
  return undefined;
}

/** Always returns a renderable src for UI (real photo or AAC placeholder). */
export function listingDisplayPhotoUrl(photo: unknown): string {
  return resolveListingPhotoUrl(photo) ?? LISTING_PHOTO_PLACEHOLDER;
}

/** Always returns a renderable cover src for UI (first real photo or AAC placeholder). */
export function firstListingDisplayPhotoUrl(photos: unknown): string {
  return resolveFirstListingPhotoUrl(photos) ?? LISTING_PHOTO_PLACEHOLDER;
}

export function isListingPhotoPlaceholder(src: string | null | undefined): boolean {
  if (!src) return true;
  return src === LISTING_PHOTO_PLACEHOLDER || src === "/placeholder.svg";
}
