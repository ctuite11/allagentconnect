import { supabase } from "@/integrations/supabase/client";

export function resolveListingPhotoUrl(photo: unknown): string | undefined {
  if (typeof photo === "string") {
    const trimmed = photo.trim();
    return trimmed || undefined;
  }
  if (photo && typeof photo === "object") {
    const record = photo as Record<string, unknown>;
    const raw = record.url ?? record.publicUrl;
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    if (raw.startsWith("http")) return raw;
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(raw);
    return data.publicUrl || undefined;
  }
  return undefined;
}

export function resolveFirstListingPhotoUrl(photos: unknown): string | undefined {
  if (!Array.isArray(photos) || photos.length === 0) return undefined;
  return resolveListingPhotoUrl(photos[0]);
}
