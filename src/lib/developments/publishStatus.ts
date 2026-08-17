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

export const LIFECYCLE_STATUSES: DevelopmentLifecycleStatus[] = [
  "coming_soon",
  "pre_construction",
  "under_construction",
  "now_selling",
  "completed",
];

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
