import type { SupabaseClient } from "@supabase/supabase-js";
import { getPrimaryPhotoUrl } from "@/components/buyer/buyerListingDisplay";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

/**
 * Matches `loadHotSheetPreviewPhotos` in `ClientDashboard` — criteria-based thumbnails + counts.
 */
export async function loadHotSheetPhotosAndCounts(
  supabase: SupabaseClient,
  sheets: { id: string; criteria: Record<string, unknown> | null }[],
): Promise<{ photosById: Record<string, string[]>; countsById: Record<string, number> }> {
  if (!sheets.length) {
    return { photosById: {}, countsById: {} };
  }

  const previewEntries = await Promise.all(
    sheets.map(async (sheet) => {
      try {
        const { data: listings, error } = await buildListingsQuery(supabase, sheet.criteria || {}).limit(1000);
        if (error) {
          console.error("Failed to load preview listings for hot sheet", sheet.id, error);
          return [sheet.id, [] as string[], 0] as const;
        }

        const photoUrls = (listings || [])
          .map((listing: unknown) => getPrimaryPhotoUrl((listing as { photos?: unknown })?.photos))
          .filter((url): url is string => Boolean(url))
          .slice(0, 4);

        return [sheet.id, photoUrls, listings?.length ?? 0] as const;
      } catch (err) {
        console.error("Unexpected preview listing load error", sheet.id, err);
        return [sheet.id, [] as string[], 0] as const;
      }
    }),
  );

  return {
    photosById: Object.fromEntries(previewEntries.map(([id, photos]) => [id, photos])),
    countsById: Object.fromEntries(previewEntries.map(([id, , count]) => [id, count])),
  };
}
