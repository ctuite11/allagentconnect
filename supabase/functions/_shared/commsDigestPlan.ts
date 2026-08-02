/**
 * Pure send-time planner for Comms Center digests (Aug 2026 opt-in policy).
 *
 * Separation of concerns:
 *   - a preference LOOKUP FAILURE must never look like a mute: it preserves
 *     every item and fails the send for retry
 *   - only a successful lookup proving missing row / master off / category off
 *     may retire items
 *   - unknown / blank categories are blocked and quarantined, never evaluated
 *     using another category's permission
 */

import {
  categoryColumnFor,
  evaluateCommsOptIn,
  type CommsPrefsRow,
} from "./commsOptIn.ts";

export type PlannableItem = { id: string; category: string | null };

export type PrefsLookupResult =
  | { ok: true; row: NonNullable<CommsPrefsRow> | null }
  | { ok: false; error: string };

export type DigestPlan<T extends PlannableItem> =
  | { outcome: "preserve_and_fail"; error: string }
  | {
    outcome: "proceed";
    deliverable: T[];
    mutedItemIds: string[];
    unknownCategoryItemIds: string[];
  };

export function planDigestDelivery<T extends PlannableItem>(
  prefs: PrefsLookupResult,
  items: T[],
): DigestPlan<T> {
  if (!prefs.ok) return { outcome: "preserve_and_fail", error: prefs.error };

  const deliverable: T[] = [];
  const mutedItemIds: string[] = [];
  const unknownCategoryItemIds: string[] = [];

  for (const item of items) {
    const column = categoryColumnFor(item.category);
    if (!column) {
      unknownCategoryItemIds.push(item.id);
      continue;
    }
    if (evaluateCommsOptIn(prefs.row, column).allowed) deliverable.push(item);
    else mutedItemIds.push(item.id);
  }

  return { outcome: "proceed", deliverable, mutedItemIds, unknownCategoryItemIds };
}
