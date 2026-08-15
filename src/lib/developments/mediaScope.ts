import type { DevelopmentMediaRow } from "./types";

/** Project hero/gallery media — not scoped to unit, floor plan, or update. */
export function isProjectLevelMedia(
  media: Pick<DevelopmentMediaRow, "floor_plan_id" | "unit_id" | "update_id">,
): boolean {
  return media.floor_plan_id == null && media.unit_id == null && media.update_id == null;
}

/** Kinds safe to render in an <img>. */
export function isImageCapableKind(kind: string | null | undefined): boolean {
  return kind === "photo" || kind === "video_poster";
}

export function isVideoOrTourKind(kind: string | null | undefined): boolean {
  return kind === "video" || kind === "virtual_tour";
}

export function selectProjectHero(
  media: DevelopmentMediaRow[],
): DevelopmentMediaRow | null {
  const project = media.filter(isProjectLevelMedia);
  return (
    project.find((m) => m.is_hero && isImageCapableKind(m.kind)) ??
    project.find((m) => isImageCapableKind(m.kind)) ??
    null
  );
}

export function projectGalleryPhotos(media: DevelopmentMediaRow[]): DevelopmentMediaRow[] {
  return media.filter(
    (m) => isProjectLevelMedia(m) && m.kind === "photo" && !m.is_hero,
  );
}

/** All project-level photos (including hero), sorted for gallery display. */
export function projectLevelPhotos(media: DevelopmentMediaRow[]): DevelopmentMediaRow[] {
  return media
    .filter((m) => isProjectLevelMedia(m) && m.kind === "photo")
    .slice()
    .sort((a, b) => {
      if (a.is_hero !== b.is_hero) return a.is_hero ? -1 : 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
}

/**
 * Photos for the below-hero preview mosaic.
 * Prefer non-hero gallery shots; if fewer than 3, include hero to keep the strip strong.
 */
export function projectGalleryPreviewPhotos(
  media: DevelopmentMediaRow[],
  limit = 5,
): DevelopmentMediaRow[] {
  const all = projectLevelPhotos(media);
  const nonHero = all.filter((m) => !m.is_hero);
  const source = nonHero.length >= 3 ? nonHero : all;
  return source.slice(0, limit);
}

export function projectGalleryVideos(media: DevelopmentMediaRow[]): DevelopmentMediaRow[] {
  return media.filter((m) => isProjectLevelMedia(m) && isVideoOrTourKind(m.kind));
}

export function floorPlanImageUrl(
  media: DevelopmentMediaRow[],
  mediaUrls: Record<string, string>,
  floorPlanId: string,
): string | null {
  const match = media.find(
    (m) =>
      m.floor_plan_id === floorPlanId &&
      isImageCapableKind(m.kind) &&
      Boolean(mediaUrls[m.id]),
  );
  return match ? mediaUrls[match.id] ?? null : null;
}

export function unitImageMedia(
  media: DevelopmentMediaRow[],
  unitId: string,
): DevelopmentMediaRow[] {
  return media.filter((m) => m.unit_id === unitId && isImageCapableKind(m.kind));
}
