import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { planDigestDelivery, type PrefsLookupResult } from "./commsDigestPlan.ts";

const ON = {
  user_id: "a",
  client_needs_enabled: true,
  new_matches_enabled: true,
  buyer_need: true,
  renter_need: true,
  sales_intel: true,
  general_discussion: true,
};

const items = [
  { id: "1", category: "Buyer Need" },
  { id: "2", category: "Sales Intel" },
  { id: "3", category: "Renter Need" },
];

Deno.test("transient preference lookup failure preserves ALL digest items", () => {
  const prefs: PrefsLookupResult = { ok: false, error: "connection reset" };
  const plan = planDigestDelivery(prefs, items);
  assertEquals(plan.outcome, "preserve_and_fail");
  if (plan.outcome === "preserve_and_fail") assertEquals(plan.error, "connection reset");
});

Deno.test("explicit mute (proven lookup) retires the muted items only", () => {
  const plan = planDigestDelivery({ ok: true, row: { ...ON, sales_intel: false } }, items);
  if (plan.outcome !== "proceed") throw new Error("expected proceed");
  assertEquals(plan.deliverable.map((i) => i.id), ["1", "3"]);
  assertEquals(plan.mutedItemIds, ["2"]);
  assertEquals(plan.unknownCategoryItemIds, []);
});

Deno.test("missing row retires everything, delivers nothing", () => {
  const plan = planDigestDelivery({ ok: true, row: null }, items);
  if (plan.outcome !== "proceed") throw new Error("expected proceed");
  assertEquals(plan.deliverable.length, 0);
  assertEquals(plan.mutedItemIds, ["1", "2", "3"]);
});

Deno.test("unknown category never maps to buyer_need — quarantined, not delivered", () => {
  const plan = planDigestDelivery({ ok: true, row: ON }, [
    { id: "1", category: "Buyer Need" },
    { id: "x", category: "Quantum Leads" },
    { id: "y", category: null },
    { id: "z", category: "  " },
  ]);
  if (plan.outcome !== "proceed") throw new Error("expected proceed");
  assertEquals(plan.deliverable.map((i) => i.id), ["1"]);
  assertEquals(plan.unknownCategoryItemIds, ["x", "y", "z"]);
  assertEquals(plan.mutedItemIds, []);
});

/* --- production-shaped simulation of the send routine's ordering --- */

type Step = string;

function runSend(
  prefs: PrefsLookupResult,
  all: Array<{ id: string; category: string | null }>,
  retirementFails: boolean,
): { steps: Step[]; subjectCount: number | null; bodyCount: number | null } {
  const steps: Step[] = [];
  const plan = planDigestDelivery(prefs, all);
  if (plan.outcome === "preserve_and_fail") {
    steps.push("mark_failed", "items_preserved");
    return { steps, subjectCount: null, bodyCount: null };
  }
  const retire = [...plan.mutedItemIds, ...plan.unknownCategoryItemIds];
  if (retire.length) {
    if (retirementFails) {
      steps.push("mark_failed");
      return { steps, subjectCount: null, bodyCount: null };
    }
    steps.push("retired:" + retire.join(","));
  }
  if (plan.deliverable.length === 0) {
    steps.push("skipped");
    return { steps, subjectCount: null, bodyCount: null };
  }
  steps.push("email_job_created");
  return {
    steps,
    subjectCount: plan.deliverable.length,
    bodyCount: plan.deliverable.length,
  };
}

Deno.test("delete/retirement failure prevents email job creation", () => {
  const out = runSend({ ok: true, row: { ...ON, sales_intel: false } }, items, true);
  assertEquals(out.steps.includes("email_job_created"), false);
  assertEquals(out.steps, ["mark_failed"]);
});

Deno.test("lookup failure creates no email job and preserves items", () => {
  const out = runSend({ ok: false, error: "boom" }, items, false);
  assertEquals(out.steps, ["mark_failed", "items_preserved"]);
  assertEquals(out.subjectCount, null);
});

Deno.test("filtered digest subject and body show the same count", () => {
  const out = runSend({ ok: true, row: { ...ON, sales_intel: false } }, items, false);
  assertEquals(out.steps.includes("email_job_created"), true);
  assertEquals(out.subjectCount, 2);
  assertEquals(out.bodyCount, 2);
  assertEquals(out.subjectCount, out.bodyCount);
});
