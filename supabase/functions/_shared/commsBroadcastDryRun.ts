/**
 * Dry-run report helpers for Communications Center broadcasts
 * (`send-client-need-notification`).
 *
 * Zero writes — pure summarization of already-loaded audience / opt-in /
 * cadence partitions.
 *
 * Public dry-run terminology:
 *   - `explicit_broad_opt_in` = agent explicitly enabled Communications and
 *     chose no narrowing criteria (internal partition reason
 *     `preferences_unset`). Missing preference rows are NEVER this case;
 *     they are blocked as `missing_row`.
 */

import type { OptInDecision } from "./commsOptIn.ts";
import type { CommsSchedule } from "./commsDigest.ts";
import type { PartitionReason } from "./verifiedAgentAudience.ts";

export type OptInBlockCounts = {
  missing_row: number;
  client_needs_disabled: number;
  new_matches_disabled: number;
  category_off: number;
  lookup_error: number;
};

/** Public dry-run matching reason (maps internal preferences_unset). */
export type DryRunMatchingReason = "preferences_match" | "explicit_broad_opt_in";

export type DryRunCadenceCounts = {
  immediate: number;
  daily: number;
  weekly: number;
  skipped_muted: number;
};

export type DryRunRecipient = {
  user_id: string;
  name: string;
  email: string;
  cadence: CommsSchedule;
  matching_reason: DryRunMatchingReason;
};

export function toDryRunMatchingReason(
  reason: PartitionReason,
): DryRunMatchingReason {
  return reason === "preferences_unset" ? "explicit_broad_opt_in" : "preferences_match";
}

export function countOptInBlockReasons(
  blocked: Map<string, OptInDecision["reason"]>,
): OptInBlockCounts {
  const counts: OptInBlockCounts = {
    missing_row: 0,
    client_needs_disabled: 0,
    new_matches_disabled: 0,
    category_off: 0,
    lookup_error: 0,
  };
  for (const reason of blocked.values()) {
    if (reason === "missing_row") counts.missing_row++;
    else if (reason === "client_needs_disabled") counts.client_needs_disabled++;
    else if (reason === "new_matches_disabled") counts.new_matches_disabled++;
    else if (reason === "category_off") counts.category_off++;
    else if (reason === "lookup_error") counts.lookup_error++;
    // unknown_category and other reasons are not part of the public contract;
    // they remain blocked at selection time but are not counted here.
  }
  return counts;
}

export function buildDryRunRecipientRoster<
  T extends {
    agent_id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    reason: PartitionReason;
  },
>(
  immediate: T[],
  digest: Array<T & { cadence: "daily" | "weekly" }>,
): DryRunRecipient[] {
  const nameOf = (r: T) =>
    `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "AAC Agent";

  const roster: DryRunRecipient[] = [
    ...immediate.map((r) => ({
      user_id: r.agent_id,
      name: nameOf(r),
      email: r.email,
      cadence: "immediate" as const,
      matching_reason: toDryRunMatchingReason(r.reason),
    })),
    ...digest.map((r) => ({
      user_id: r.agent_id,
      name: nameOf(r),
      email: r.email,
      cadence: r.cadence,
      matching_reason: toDryRunMatchingReason(r.reason),
    })),
  ];

  roster.sort((a, b) => a.name.localeCompare(b.name) || a.user_id.localeCompare(b.user_id));
  return roster;
}

export function cadenceCountsFromPartition(
  immediateCount: number,
  digest: Array<{ cadence: "daily" | "weekly" }>,
  skippedMuted: number,
): DryRunCadenceCounts {
  let daily = 0;
  let weekly = 0;
  for (const r of digest) {
    if (r.cadence === "daily") daily++;
    else weekly++;
  }
  return {
    immediate: immediateCount,
    daily,
    weekly,
    skipped_muted: skippedMuted,
  };
}

/** Deliverable total after schedule muting: immediate + daily + weekly. */
export function finalTotalRecipients(cadence: DryRunCadenceCounts): number {
  return cadence.immediate + cadence.daily + cadence.weekly;
}
