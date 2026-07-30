export type AnnouncementStatus = "active" | "archived";

export interface AnnouncementDefinition {
  /** Stable versioned id persisted in agent_settings.dismissed_announcement_ids */
  id: string;
  status: AnnouncementStatus;
  /** ISO date the announcement went live. Accounts created after this never see it. */
  publishedAt: string;
  /** Optional ISO expiration. After this it never shows. */
  expiresAt?: string;
}

/** Versioned ID — future announcements use a new ID and show independently. */
export const MESSAGING_PREFERENCES_FIX_ANNOUNCEMENT_ID =
  "messaging-preferences-fix-2026-07";

export const ANNOUNCEMENTS: Record<string, AnnouncementDefinition> = {
  [MESSAGING_PREFERENCES_FIX_ANNOUNCEMENT_ID]: {
    id: MESSAGING_PREFERENCES_FIX_ANNOUNCEMENT_ID,
    // Archived: historical messaging-bug apology, no longer shown to anyone.
    status: "archived",
    publishedAt: "2026-07-21T00:00:00Z",
    expiresAt: "2026-07-30T00:00:00Z",
  },
};

/**
 * Eligibility rules:
 * - archived → never show
 * - past expiresAt → never show
 * - account created at/after publishedAt → never show (historical notice)
 * - already dismissed → never show
 */
export function isAnnouncementEligible(params: {
  announcementId: string;
  accountCreatedAt?: string | null;
  dismissedIds: string[];
  now?: Date;
}): boolean {
  const { announcementId, accountCreatedAt, dismissedIds } = params;
  const def = ANNOUNCEMENTS[announcementId];
  if (!def) return false;
  if (def.status !== "active") return false;

  const now = params.now ?? new Date();
  if (def.expiresAt && now.getTime() >= new Date(def.expiresAt).getTime()) return false;

  const publishedMs = new Date(def.publishedAt).getTime();
  if (Number.isNaN(publishedMs)) return false;
  if (now.getTime() < publishedMs) return false;

  if (accountCreatedAt) {
    const createdMs = new Date(accountCreatedAt).getTime();
    if (!Number.isNaN(createdMs) && createdMs >= publishedMs) return false;
  }

  return !dismissedIds.includes(announcementId);
}
