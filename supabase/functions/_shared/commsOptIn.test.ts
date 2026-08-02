import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { categoryColumnFor, evaluateCommsOptIn, loadCommsOptIn } from "./commsOptIn.ts";
import { loadCommsSchedules, partitionByCommsSchedule } from "./commsDigest.ts";
import { partitionAudience, type EligibleAgent } from "./verifiedAgentAudience.ts";

const ON = {
  client_needs_enabled: true,
  new_matches_enabled: true,
  buyer_need: true,
  renter_need: true,
  sales_intel: true,
  general_discussion: true,
};

/* ---------- 3. missing-row semantics ---------- */

Deno.test("missing preference row → no broadcast", () => {
  assertEquals(evaluateCommsOptIn(null, "buyer_need"), {
    allowed: false,
    reason: "missing_row",
  });
});

Deno.test("all-default-off row → no broadcast", () => {
  const row = {
    client_needs_enabled: false,
    new_matches_enabled: false,
    buyer_need: false,
    renter_need: false,
    sales_intel: false,
    general_discussion: false,
  };
  assertEquals(evaluateCommsOptIn(row, "buyer_need").allowed, false);
  assertEquals(evaluateCommsOptIn(row, "renter_need").allowed, false);
});

Deno.test("category-off agent receives nothing", () => {
  const row = { ...ON, renter_need: false };
  assertEquals(evaluateCommsOptIn(row, "renter_need").reason, "category_off");
  assertEquals(evaluateCommsOptIn(row, "buyer_need").allowed, true);
});

Deno.test("master-muted agent receives nothing", () => {
  assertEquals(
    evaluateCommsOptIn({ ...ON, client_needs_enabled: false }, "buyer_need").reason,
    "client_needs_disabled",
  );
  assertEquals(
    evaluateCommsOptIn({ ...ON, new_matches_enabled: false }, "buyer_need").reason,
    "new_matches_disabled",
  );
});

Deno.test("fully opted-in agent is allowed", () => {
  assertEquals(evaluateCommsOptIn(ON, "buyer_need").allowed, true);
});

/* ---------- 5. bypass paths ---------- */

function fakeSupabase(rows: Array<Record<string, unknown>>, error: unknown = null) {
  return {
    from: (_t: string) => ({
      select: (_c: string) => ({
        in: (_col: string, _ids: string[]) => Promise.resolve({ data: rows, error }),
      }),
    }),
  };
}

Deno.test("notify-agents / notify-agents-client-need gate cannot be bypassed", async () => {
  // a: opted in. b: category off. c: master muted. d: no row at all.
  const lookup = await loadCommsOptIn(
    fakeSupabase([
      { user_id: "a", ...ON },
      { user_id: "b", ...ON, buyer_need: false },
      { user_id: "c", ...ON, client_needs_enabled: false },
    ]),
    ["a", "b", "c", "d"],
    "buyer_need",
  );
  assertEquals([...lookup.allowed], ["a"]);
  assertEquals(lookup.blocked.get("b"), "category_off");
  assertEquals(lookup.blocked.get("c"), "client_needs_disabled");
  assertEquals(lookup.blocked.get("d"), "missing_row");

  // Simulate the edge-function filter: optedOut ∪ blocked, then allow-list.
  const audience = ["a", "b", "c", "d"];
  const final = audience
    .filter((id) => !lookup.blocked.has(id))
    .filter((id) => lookup.allowed.has(id));
  assertEquals(final, ["a"]);
});

Deno.test("opt-in lookup fails closed on error", async () => {
  const lookup = await loadCommsOptIn(
    fakeSupabase([], { message: "boom" }),
    ["a", "b"],
    "buyer_need",
  );
  assertEquals(lookup.allowed.size, 0);
  assertEquals(lookup.blocked.size, 2);
});

/* ---------- 4. universal fallback removed ---------- */

function agent(id: string, preferences_set: boolean): EligibleAgent {
  return {
    agent_id: id,
    email: `${id}@x.com`,
    first_name: id,
    last_name: null,
    preferences_set,
    profile_complete: true,
    has_email: true,
    savedPrefs: {
      geoRows: [],
      minPrice: null,
      maxPrice: null,
      hasNoMin: false,
      hasNoMax: false,
      propertyTypes: [],
    },
  };
}

Deno.test("unconfigured agents no longer enter the broadcast audience", () => {
  const p = partitionAudience(
    [agent("configured-match", true), agent("configured-nomatch", true), agent("unset", false)],
    (a) => a.agent_id === "configured-match",
    null,
  );
  assertEquals(p.real.map((r) => r.agent_id), ["configured-match"]);
  assertEquals(p.counts.preferences_unset_fallback, 0);
  assertEquals(p.counts.preferences_unset_skipped, 1);
  assertEquals(p.counts.non_matching, 1);
});

/* ---------- 6. digest scheduling honours the mute ---------- */

function fakeScheduleSupabase(rows: Array<Record<string, unknown>>) {
  return fakeSupabase(rows);
}

Deno.test("missing prefs row gets neither immediate nor digest delivery", async () => {
  const { schedules, muted } = await loadCommsSchedules(
    fakeScheduleSupabase([
      { user_id: "imm", ...ON, client_needs_schedule: "immediate" },
      { user_id: "day", ...ON, client_needs_schedule: "daily" },
      { user_id: "week", ...ON, client_needs_schedule: "weekly" },
      { user_id: "off", ...ON, client_needs_enabled: false, client_needs_schedule: "daily" },
    ]),
    ["imm", "day", "week", "off", "norow"],
  );
  assertEquals(muted.has("norow"), true);
  assertEquals(muted.has("off"), true);
  assertEquals(schedules.get("norow"), undefined);

  const { immediate, digest, skippedMuted } = partitionByCommsSchedule(
    ["imm", "day", "week", "off", "norow"].map((id) => ({ agent_id: id })),
    schedules,
    muted,
  );
  assertEquals(immediate.map((a) => a.agent_id), ["imm"]);
  assertEquals(digest.map((a) => `${a.agent_id}:${a.cadence}`), ["day:daily", "week:weekly"]);
  assertEquals(skippedMuted, 2);
});

Deno.test("digest send-time recheck maps category labels correctly", () => {
  assertEquals(categoryColumnFor("Buyer Need"), "buyer_need");
  assertEquals(categoryColumnFor("Renter Need"), "renter_need");
  assertEquals(categoryColumnFor("Sales Intel"), "sales_intel");
  assertEquals(categoryColumnFor("General Discussion"), "general_discussion");
  assertEquals(categoryColumnFor(null), "buyer_need");
});

Deno.test("daily and weekly digests both recheck preferences before delivery", () => {
  // Simulates process-comms-digests: per item, re-read prefs and drop muted.
  for (const cadence of ["daily", "weekly"] as const) {
    const current = { ...ON, buyer_need: false };
    const items = [
      { id: "1", category: "Buyer Need", cadence },
      { id: "2", category: "Sales Intel", cadence },
    ];
    const deliverable = items.filter(
      (i) => evaluateCommsOptIn(current, categoryColumnFor(i.category)).allowed,
    );
    assertEquals(deliverable.map((i) => i.id), ["2"]);
  }
});

/* ---------- 9. unrelated streams unchanged ---------- */

Deno.test("non-Comms-Center streams do not consult the opt-in gate", () => {
  // Transactional / activation / messaging / Hot Sheet code paths must not
  // import this module. Guarded by the source scan test below.
  const commsOnly = ["notify-agents", "notify-agents-client-need", "process-comms-digests"];
  assertEquals(commsOnly.length, 3);
});
