import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDryRunRecipientRoster,
  cadenceCountsFromPartition,
  countOptInBlockReasons,
  finalTotalRecipients,
  toDryRunMatchingReason,
} from "./commsBroadcastDryRun.ts";
import type { PartitionReason } from "./verifiedAgentAudience.ts";

Deno.test("countOptInBlockReasons keeps master switches separate", () => {
  const blocked = new Map<string, any>([
    ["a", "missing_row"],
    ["b", "client_needs_disabled"],
    ["c", "new_matches_disabled"],
    ["d", "category_off"],
    ["e", "lookup_error"],
  ]);
  assertEquals(countOptInBlockReasons(blocked), {
    missing_row: 1,
    client_needs_disabled: 1,
    new_matches_disabled: 1,
    category_off: 1,
    lookup_error: 1,
  });
});

Deno.test("toDryRunMatchingReason maps preferences_unset to explicit_broad_opt_in", () => {
  assertEquals(toDryRunMatchingReason("preferences_unset"), "explicit_broad_opt_in");
  assertEquals(toDryRunMatchingReason("preferences_match"), "preferences_match");
});

Deno.test("buildDryRunRecipientRoster uses explicit_broad_opt_in in public reasons", () => {
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
    "imm-1:immediate:explicit_broad_opt_in",
    "week-1:weekly:preferences_match",
  ]);
  assertEquals(roster.some((r) => (r.matching_reason as string) === "preferences_unset"), false);
});

Deno.test("finalTotalRecipients equals immediate + daily + weekly", () => {
  const cadence = cadenceCountsFromPartition(
    2,
    [{ cadence: "daily" }, { cadence: "daily" }, { cadence: "weekly" }],
    1,
  );
  assertEquals(cadence, { immediate: 2, daily: 2, weekly: 1, skipped_muted: 1 });
  assertEquals(finalTotalRecipients(cadence), 5);
});

Deno.test("send-client-need-notification dry-run returns the approved report contract", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-client-need-notification/index.ts", import.meta.url),
  );
  const dryBlock = src.slice(src.indexOf("if (dryRun)"), src.indexOf("// 5. Persist broadcast"));

  assertEquals(dryBlock.includes("network_rpc_base"), true);
  assertEquals(dryBlock.includes("opt_in_blocked"), true);
  assertEquals(dryBlock.includes("missing_row"), true);
  assertEquals(dryBlock.includes("client_needs_disabled"), true);
  assertEquals(dryBlock.includes("new_matches_disabled"), true);
  assertEquals(dryBlock.includes("category_off"), true);
  assertEquals(dryBlock.includes("lookup_error"), true);
  assertEquals(dryBlock.includes("master_off"), false);
  assertEquals(dryBlock.includes("cadence_counts"), true);
  assertEquals(dryBlock.includes("explicit_broad_opt_in"), true);
  assertEquals(dryBlock.includes("final_total_recipients"), true);
  // Public response must not expose the old field names as keys.
  assertEquals(/^\s*preferences_unset_fallback\s*:/m.test(dryBlock), false);
  assertEquals(/^\s*final_deliverable_recipients\s*:/m.test(dryBlock), false);
  assertEquals(dryBlock.includes("matching_reason"), true);
  assertEquals(dryBlock.includes("buildDryRunRecipientRoster"), true);
  assertEquals(dryBlock.includes("partitionByCommsSchedule"), true);
  assertEquals(/email_jobs|comms_broadcasts|insertDigestItems/.test(dryBlock), false);
  assertEquals(/Missing row => channel On|untouched account/i.test(src), false);
});
