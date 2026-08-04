import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDryRunRecipientRoster,
  cadenceCountsFromPartition,
  countOptInBlockReasons,
} from "./commsBroadcastDryRun.ts";
import type { PartitionReason } from "./verifiedAgentAudience.ts";

Deno.test("countOptInBlockReasons separates missing-row, master-off, category-off, lookup-error", () => {
  const blocked = new Map<string, any>([
    ["a", "missing_row"],
    ["b", "client_needs_disabled"],
    ["c", "new_matches_disabled"],
    ["d", "category_off"],
    ["e", "lookup_error"],
    ["f", "unknown_category"],
  ]);
  assertEquals(countOptInBlockReasons(blocked), {
    missing_row: 1,
    master_off: 2,
    category_off: 1,
    lookup_error: 1,
    unknown_category: 1,
  });
});

Deno.test("buildDryRunRecipientRoster includes cadence and matching reason", () => {
  type Row = {
    agent_id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    reason: PartitionReason;
  };
  const immediate: Row[] = [
    {
      agent_id: "imm-1",
      email: "imm@example.com",
      first_name: "Imm",
      last_name: "Ediate",
      reason: "preferences_unset",
    },
  ];
  const digest: Array<Row & { cadence: "daily" | "weekly" }> = [
    {
      agent_id: "day-1",
      email: "day@example.com",
      first_name: "Daily",
      last_name: "Agent",
      reason: "preferences_match",
      cadence: "daily",
    },
    {
      agent_id: "week-1",
      email: "week@example.com",
      first_name: "Weekly",
      last_name: "Agent",
      reason: "preferences_match",
      cadence: "weekly",
    },
  ];
  const roster = buildDryRunRecipientRoster(immediate, digest);
  assertEquals(roster.map((r) => `${r.user_id}:${r.cadence}:${r.matching_reason}`), [
    "day-1:daily:preferences_match",
    "imm-1:immediate:preferences_unset",
    "week-1:weekly:preferences_match",
  ]);
  assertEquals(roster[0].name, "Daily Agent");
  assertEquals(roster[0].email, "day@example.com");
});

Deno.test("cadenceCountsFromPartition reports immediate/daily/weekly/muted", () => {
  assertEquals(
    cadenceCountsFromPartition(
      2,
      [{ cadence: "daily" }, { cadence: "daily" }, { cadence: "weekly" }],
      1,
    ),
    { immediate: 2, daily: 2, weekly: 1, skipped_muted: 1 },
  );
});

Deno.test("send-client-need-notification dry-run returns the full report contract", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-client-need-notification/index.ts", import.meta.url),
  );
  assertEquals(src.includes("network_rpc_base"), true);
  assertEquals(src.includes("opt_in_blocked"), true);
  assertEquals(src.includes("missing_row"), true);
  assertEquals(src.includes("master_off"), true);
  assertEquals(src.includes("category_off"), true);
  assertEquals(src.includes("lookup_error"), true);
  assertEquals(src.includes("cadence_counts"), true);
  assertEquals(src.includes("recipients"), true);
  assertEquals(src.includes("matching_reason"), true);
  assertEquals(src.includes("buildDryRunRecipientRoster"), true);
  assertEquals(src.includes("partitionByCommsSchedule"), true);
  // Dry-run must remain write-free.
  const dryBlock = src.slice(src.indexOf("if (dryRun)"), src.indexOf("// 5. Persist broadcast"));
  assertEquals(/email_jobs|comms_broadcasts|insertDigestItems/.test(dryBlock), false);
});
