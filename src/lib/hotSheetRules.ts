/**
 * LOCKED Hot Sheet rules — single frontend source of truth.
 * Each rule is covered by src/lib/hotSheetRules.test.ts. Changing a rule
 * requires changing its test in the same change (see AGENTS.md).
 */
export {
  DEFAULT_HOT_SHEET_STATUSES,
} from "@/lib/hotSheetCriteriaCore";
export { HOT_SHEET_FILTER_STATUSES } from "@/constants/status";

export interface RelationshipLike {
  status?: string | null;
  client_id?: string | null;
  ended_at?: string | null;
}

/**
 * Connected buyer = an active buyer-agent relationship with a linked buyer
 * account that has not ended. Accepted invitations alone never count
 * (matches process-hot-sheet).
 */
export function isBuyerConnected(rel: RelationshipLike | null | undefined): boolean {
  if (!rel) return false;
  return String(rel.status) === "active" && rel.client_id != null && !rel.ended_at;
}

/**
 * A first dashboard invite is due when the buyer is not connected and no live
 * global invite exists. Callers must pass tokens already run through
 * filterStaleInviteTokens so deleted contacts/Hot Sheets never block it.
 */
export function isFirstInviteEligible(connected: boolean, liveGlobalTokenCount: number): boolean {
  return !connected && liveGlobalTokenCount === 0;
}

export const FIRST_BATCH_CTA = {
  pendingInvite: "Send First Batch & Invite",
  alreadySent: "Send Selected Matches",
  connected: "Send First Batch",
} as const;

/** Hot Sheet Review send button label. Pending buyers always win. */
export function getFirstBatchCta(opts: {
  hasPendingInviteRecipients: boolean;
  allFirstBatchQueued: boolean;
}): string {
  if (opts.hasPendingInviteRecipients) return FIRST_BATCH_CTA.pendingInvite;
  if (opts.allFirstBatchQueued) return FIRST_BATCH_CTA.alreadySent;
  return FIRST_BATCH_CTA.connected;
}
