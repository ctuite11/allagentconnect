import type { DevelopmentLifecycleStatus } from "./types";

/** Backend publish_status values on public.developments. */
export type DevelopmentPublishStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "paused"
  | "archived";

export type DevelopmentMemberRole = "owner" | "editor" | "sales" | "viewer";

export const PUBLISH_STATUSES: DevelopmentPublishStatus[] = [
  "draft",
  "pending_review",
  "published",
  "paused",
  "archived",
];

/** Physical construction stages (developments.stage). */
export const DEVELOPMENT_STAGES: DevelopmentLifecycleStatus[] = [
  "planning",
  "pre_construction",
  "under_construction",
  "completed",
];

/** @deprecated use DEVELOPMENT_STAGES */
export const LIFECYCLE_STATUSES = DEVELOPMENT_STAGES;

/** Marketing sales states (developments.sales_status). */
export const DEVELOPMENT_SALES_STATUSES = [
  "not_yet_released",
  "coming_soon",
  "now_selling",
  "final_units",
  "sold_out",
] as const;

export const DEVELOPMENT_BUILDING_TYPES = [
  "high_rise",
  "mid_rise",
  "low_rise",
  "garden_style",
  "three_family",
  "two_family",
  "single_family",
  "townhomes",
  "condo_community",
  "loft_conversion",
  "brownstone",
  "mixed_use",
  "other",
] as const;

export const DEVELOPMENT_BUILDING_AMENITIES = [
  "concierge_doorman",
  "elevator",
  "fitness_center",
  "pool",
  "roof_deck",
  "resident_lounge",
  "business_center",
  "package_room",
  "bike_storage",
  "garage_parking",
  "ev_charging",
  "storage",
  "pet_friendly",
  "dog_wash_pet_spa",
  "common_outdoor_space",
  "security",
  "other",
] as const;

export const DEVELOPMENT_UNIT_FEATURES = [
  "balcony",
  "terrace",
  "private_roof_deck",
  "in_unit_laundry",
  "central_air",
  "fireplace",
  "walk_in_closet",
  "floor_to_ceiling_windows",
  "water_views",
  "city_views",
  "garage_parking",
  "ev_charging",
  "private_elevator",
  "smart_home",
  "storage",
  "other",
] as const;

export const DEVELOPMENT_UNIT_TYPES = [
  "studio",
  "flat",
  "duplex",
  "triplex",
  "loft",
  "penthouse",
  "townhome",
  "live_work",
  "commercial",
] as const;

export const DEVELOPMENT_UNIT_STATUSES = [
  "not_released",
  "coming_soon",
  "available",
  "reserved",
  "under_agreement",
  "sold",
] as const;

export function publishStatusLabel(status: string | null | undefined): string {
  const map: Record<DevelopmentPublishStatus, string> = {
    draft: "Draft",
    pending_review: "Pending review",
    published: "Published",
    paused: "Paused",
    archived: "Archived",
  };
  return map[status as DevelopmentPublishStatus] ?? "Unknown";
}

export function publishStatusTone(
  status: string | null | undefined,
): "neutral" | "warning" | "success" | "muted" {
  switch (status) {
    case "pending_review":
      return "warning";
    case "published":
      return "success";
    case "paused":
    case "archived":
      return "muted";
    default:
      return "neutral";
  }
}

/** Member-allowed transitions (owner/editor). Admin has a wider matrix. */
export function memberPublishTransitions(
  from: string | null | undefined,
): DevelopmentPublishStatus[] {
  if (from === "draft") return ["pending_review"];
  if (from === "pending_review") return ["draft"];
  return [];
}

export function adminPublishTransitions(
  from: string | null | undefined,
): DevelopmentPublishStatus[] {
  switch (from) {
    case "draft":
      return ["published"];
    case "pending_review":
      return ["published", "draft", "archived"];
    case "published":
      return ["paused", "archived"];
    case "paused":
      return ["published", "archived"];
    case "archived":
      return ["draft", "published"];
    default:
      return [];
  }
}

export function canMemberEditContent(role: string | null | undefined): boolean {
  return role === "owner" || role === "editor";
}

export function slugifyDevelopmentName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
