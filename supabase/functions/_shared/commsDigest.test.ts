import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  digestWindowsOpen,
  easternDailyPeriodKey,
  easternWeeklyPeriodKey,
  normalizeCommsSchedule,
  partitionByCommsSchedule,
} from "./commsDigest.ts";

Deno.test("normalizeCommsSchedule defaults unknown to immediate", () => {
  assertEquals(normalizeCommsSchedule(null), "immediate");
  assertEquals(normalizeCommsSchedule("off"), "immediate");
  assertEquals(normalizeCommsSchedule("daily"), "daily");
  assertEquals(normalizeCommsSchedule("weekly"), "weekly");
});

Deno.test("partitionByCommsSchedule is mutually exclusive", () => {
  const agents = [
    { agent_id: "a", email: "a@x.com" },
    { agent_id: "b", email: "b@x.com" },
    { agent_id: "c", email: "c@x.com" },
    { agent_id: "d", email: "d@x.com" },
  ];
  const schedules = new Map([
    ["a", "immediate" as const],
    ["b", "daily" as const],
    ["c", "weekly" as const],
  ]);
  const muted = new Set(["d"]);
  const { immediate, digest, skippedMuted } = partitionByCommsSchedule(
    agents,
    schedules,
    muted,
  );
  assertEquals(immediate.map((x) => x.agent_id), ["a"]);
  assertEquals(digest.map((x) => `${x.agent_id}:${x.cadence}`), ["b:daily", "c:weekly"]);
  assertEquals(skippedMuted, 1);
});

Deno.test("easternDailyPeriodKey formats YYYY-MM-DD", () => {
  // 2026-07-20 22:00 UTC = 18:00 EDT
  const d = new Date("2026-07-20T22:00:00.000Z");
  assertEquals(easternDailyPeriodKey(d), "daily:2026-07-20");
});

Deno.test("digestWindowsOpen daily after 18 ET, weekly only Friday", () => {
  // Monday 18:00 EDT = 22:00 UTC
  const mon = digestWindowsOpen(new Date("2026-07-20T22:00:00.000Z"));
  assertEquals(mon.daily, true);
  assertEquals(mon.weekly, false);
  assertEquals(mon.etWeekday, "Mon");

  // Friday 18:00 EDT = 22:00 UTC (2026-07-24)
  const fri = digestWindowsOpen(new Date("2026-07-24T22:00:00.000Z"));
  assertEquals(fri.daily, true);
  assertEquals(fri.weekly, true);
  assertEquals(fri.etWeekday, "Fri");

  // Friday 17:00 EDT = 21:00 UTC — too early
  const early = digestWindowsOpen(new Date("2026-07-24T21:00:00.000Z"));
  assertEquals(early.daily, false);
  assertEquals(early.weekly, false);
});

Deno.test("easternWeeklyPeriodKey is stable for a Friday", () => {
  const fri = new Date("2026-07-24T22:00:00.000Z");
  const key = easternWeeklyPeriodKey(fri);
  assertEquals(key.startsWith("weekly:2026-W"), true);
});
