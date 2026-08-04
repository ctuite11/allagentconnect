/**
 * Dry-run report helpers for Communications Center broadcasts
 * (`send-client-need-notification`).
 *
 * Zero writes — pure summarization of already-loaded audience / opt-in /
 * cadence partitions.
 */

import type { OptInDecision } from "./commsOptIn.ts";
import type { CommsSchedule } from "./commsDigest.ts";
import type { PartitionReason } from "./verifiedAgentAudience.ts";

export type OptInBlockCounts = {
  missing_row: number;
  master_off: number;
  category_off: number;
  lookup_error: number;
  unknown_category: number;
};

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
  matching_reason: PartitionReason;
};

export function countOptInBlockReasons(
  blocked: Map<string, OptInDecision["reason"]>,
): OptInBlockCounts {
  const counts: OptInBlockCounts = {
    missing_row: 0,
    master_off: 0,
    category_off: 0,
    lookup_error: 0,
    unknown_category: 0,
  };
  for (const reason of blocked.values()) {
    if (reason === "missing_row") counts.missing_row++;
    else if (reason === "client_needs_disabled" || reason === "new_matches_disabled") {
      counts.master_off++;
    } else if (reason === "category_off") counts.category_off++;
    else if (reason === "lookup_error") counts.lookup_error++;
    else if (reason === "unknown_category") counts.unknown_category++;
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
      matching_reason: r.reason,
    })),
    ...digest.map((r) => ({
      user_id: r.agent_id,
      name: nameOf(r),
      email: r.email,
      cadence: r.cadence,
      matching_reason: r.reason,
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
