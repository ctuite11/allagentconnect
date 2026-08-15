import { describe, expect, it } from "vitest";
import {
  floorPlanImageUrl,
  isImageCapableKind,
  isProjectLevelMedia,
  projectGalleryPhotos,
  projectGalleryPreviewPhotos,
  projectLevelPhotos,
  selectProjectHero,
  unitImageMedia,
} from "./mediaScope";
import type { DevelopmentMediaRow } from "./types";

function media(partial: Partial<DevelopmentMediaRow> & Pick<DevelopmentMediaRow, "id" | "kind">): DevelopmentMediaRow {
  return {
    account_id: "a",
    development_id: "d",
    floor_plan_id: null,
    unit_id: null,
    update_id: null,
    source_type: "external",
    storage_bucket: null,
    storage_path: null,
    external_url: "https://example.com/x.jpg",
    is_hero: false,
    width: null,
    height: null,
    alt: null,
    caption: null,
    mime_type: null,
    duration_seconds: null,
    sort_order: 0,
    created_by: null,
    updated_by: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("development media scope", () => {
  it("treats only unscoped rows as project-level", () => {
    expect(isProjectLevelMedia(media({ id: "1", kind: "photo" }))).toBe(true);
    expect(isProjectLevelMedia(media({ id: "2", kind: "photo", unit_id: "u1" }))).toBe(false);
    expect(isProjectLevelMedia(media({ id: "3", kind: "photo", floor_plan_id: "fp1" }))).toBe(false);
    expect(isProjectLevelMedia(media({ id: "4", kind: "photo", update_id: "up1" }))).toBe(false);
  });

  it("only treats photo/video_poster as image-capable", () => {
    expect(isImageCapableKind("photo")).toBe(true);
    expect(isImageCapableKind("video_poster")).toBe(true);
    expect(isImageCapableKind("video")).toBe(false);
    expect(isImageCapableKind("virtual_tour")).toBe(false);
  });

  it("picks project hero from project-level image media only", () => {
    const rows = [
      media({ id: "unit", kind: "photo", unit_id: "u1", is_hero: true }),
      media({ id: "video", kind: "video", is_hero: true }),
      media({ id: "hero", kind: "photo", is_hero: true }),
      media({ id: "other", kind: "photo" }),
    ];
    expect(selectProjectHero(rows)?.id).toBe("hero");
  });

  it("excludes scoped media from project gallery photos", () => {
    const rows = [
      media({ id: "gallery", kind: "photo" }),
      media({ id: "hero", kind: "photo", is_hero: true }),
      media({ id: "fp", kind: "photo", floor_plan_id: "fp1" }),
      media({ id: "unit", kind: "photo", unit_id: "u1" }),
    ];
    expect(projectGalleryPhotos(rows).map((m) => m.id)).toEqual(["gallery"]);
  });

  it("builds preview tiles from project-level photos only", () => {
    const rows = [
      media({ id: "hero", kind: "photo", is_hero: true }),
      media({ id: "g1", kind: "photo", sort_order: 1 }),
      media({ id: "g2", kind: "photo", sort_order: 2 }),
      media({ id: "g3", kind: "photo", sort_order: 3 }),
      media({ id: "unit", kind: "photo", unit_id: "u1" }),
      media({ id: "fp", kind: "photo", floor_plan_id: "fp1" }),
    ];
    expect(projectGalleryPreviewPhotos(rows, 5).map((m) => m.id)).toEqual(["g1", "g2", "g3"]);
    expect(projectLevelPhotos(rows).map((m) => m.id)).toEqual(["hero", "g1", "g2", "g3"]);
  });

  it("resolves floor-plan and unit images from scoped image-capable media only", () => {
    const rows = [
      media({ id: "fp-video", kind: "video", floor_plan_id: "fp1" }),
      media({ id: "fp-photo", kind: "photo", floor_plan_id: "fp1" }),
      media({ id: "unit-photo", kind: "photo", unit_id: "u1" }),
      media({ id: "unit-tour", kind: "virtual_tour", unit_id: "u1" }),
    ];
    expect(floorPlanImageUrl(rows, { "fp-photo": "https://img/fp" }, "fp1")).toBe("https://img/fp");
    expect(unitImageMedia(rows, "u1").map((m) => m.id)).toEqual(["unit-photo"]);
  });
});
