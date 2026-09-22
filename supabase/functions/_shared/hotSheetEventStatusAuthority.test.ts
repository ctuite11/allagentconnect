/**
 * Permanent regression: the durable event's `new_status` is authoritative,
 * and a superseded event (listing already moved on) sends nothing.
 *
 * Pure tests — no database, no provider, no network.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { planHotSheetEventDelivery } from "./hotSheetEventClassification.ts";
import { getHotSheetStatusCopy } from "./hotSheetStatusCopy.ts";
import { agentIdempotencyKey } from "./hotSheetAgentDelivery.ts";

const LISTING = "11111111-1111-1111-1111-111111111111";
const SHEET = "Back Bay Condos";

const eventA = {
  id: "ev-A",
  listing_id: LISTING,
  trigger_op: "UPDATE",
  old_status: "active",
  new_status: "off_market",
};
const eventB = {
  id: "ev-B",
  listing_id: LISTING,
  trigger_op: "UPDATE",
  old_status: "off_market",
  new_status: "active",
};

Deno.test("Event A (active->off_market) superseded by a return to active: skipped, zero jobs", () => {
  // Listing already moved back to active before Event A is processed.
  const plan = planHotSheetEventDelivery(eventA, LISTING, "active");
  assertEquals(plan.action, "skip");
  assertEquals((plan as { reason: string }).reason, "event_superseded");
  // A skip plan carries no status/statusKey, so no subject — neither
  // "Now On MLS" nor "Off Market update" — can be produced for Event A.
  assert(!("statusKey" in plan));
  assert(!("status" in plan));
});

Deno.test("Event B (off_market->active), listing active: status change 'Now On MLS in {name}'", () => {
  const plan = planHotSheetEventDelivery(eventB, LISTING, "active");
  assertEquals(plan.action, "deliver");
  if (plan.action !== "deliver") return;
  assertEquals(plan.eventClass, "status_change");
  assertEquals(plan.status, "active");
  assertEquals(plan.statusKey, "on_mls");
  assertEquals(getHotSheetStatusCopy(plan.statusKey).subject(SHEET), `Now On MLS in ${SHEET}`);
});

Deno.test("non-superseded status event uses event.new_status for copy, claim, idempotency and sent-state", () => {
  const plan = planHotSheetEventDelivery(eventA, LISTING, "off_market");
  assertEquals(plan.action, "deliver");
  if (plan.action !== "deliver") return;
  assertEquals(plan.status, "off_market");
  assertEquals(plan.statusKey, "off_market");
  assertEquals(getHotSheetStatusCopy(plan.statusKey).subject(SHEET), `Off Market update in ${SHEET}`);
  // Idempotency status component is the event status.
  assertEquals(
    agentIdempotencyKey("hs-1", LISTING, plan.status),
    agentIdempotencyKey("hs-1", LISTING, "off_market"),
  );
});

Deno.test("status comparison is case/whitespace tolerant but never substitutes current status", () => {
  const plan = planHotSheetEventDelivery({ ...eventA, new_status: " Off_Market " }, LISTING, "off_market");
  assertEquals(plan.action, "deliver");
  if (plan.action !== "deliver") return;
  assertEquals(plan.status, "Off_Market");
  assertEquals(plan.statusKey, "off_market");
});

Deno.test("New Match superseded before processing also sends nothing", () => {
  const publish = { id: "ev-P", listing_id: LISTING, trigger_op: "UPDATE", old_status: "draft", new_status: "coming_soon" };
  assertEquals(planHotSheetEventDelivery(publish, LISTING, "active"), { action: "skip", reason: "event_superseded" });
  const ok = planHotSheetEventDelivery(publish, LISTING, "coming_soon");
  assertEquals(ok.action, "deliver");
  if (ok.action === "deliver") assertEquals(ok.eventClass, "new_match");
});

Deno.test("missing listing fails closed", () => {
  assertEquals(planHotSheetEventDelivery(eventB, LISTING, null), { action: "skip", reason: "listing_missing" });
});

Deno.test("classification skips still win over supersede check", () => {
  assertEquals(
    planHotSheetEventDelivery({ ...eventA, old_status: "off_market" }, LISTING, "off_market"),
    { action: "skip", reason: "same_status_update" },
  );
  assertEquals(
    planHotSheetEventDelivery({ ...eventA, listing_id: "other" }, LISTING, "off_market"),
    { action: "skip", reason: "event_listing_mismatch" },
  );
});

// Static guard on the matcher: live listing status must never feed copy,
// claims, idempotency or sent-state, and the plan must gate before enqueue.
Deno.test("matcher source never derives delivery status from the live listing row", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-new-match-notification/index.ts", import.meta.url),
  );
  assertEquals(/String\((l|listing)\.status\s*\|\|/.test(src), false, "String(l.status || ...) found");
  assertEquals(/normalizeStatusKey\(/.test(src), false, "normalizeStatusKey(...) on live row found");
  assertEquals(/status_at_send:\s*(?!status\b|eventStatus\b)/.test(src), false, "status_at_send not from event status");
  const planIdx = src.indexOf("planHotSheetEventDelivery(");
  const enqueueIdx = src.indexOf("enqueueHotSheetDelivery(");
  assert(planIdx > 0 && enqueueIdx > planIdx, "plan must run before any enqueue");
  assert(src.includes('isEventSuperseded(eventStatus, row.status)'), "per-hot-sheet supersede re-check missing");
  assert(src.includes("status: eventStatus"), "rows must be bound to the event status");
});
