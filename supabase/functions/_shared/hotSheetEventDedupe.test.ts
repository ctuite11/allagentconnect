/**
 * Permanent regression: Hot Sheet duplicate protection is EVENT-specific.
 *
 * - Reprocessing the same status-change event never creates a second email.
 * - A later, genuinely new transition back into the same status is a new
 *   event and is eligible for a new email.
 * - event.new_status stays the sole source of subject/status/delivery state.
 * - Superseded events create zero jobs.
 *
 * Pure tests — no database, no provider, no network. The in-memory store
 * mirrors the production arbitration: the delivery-claim unique key
 * (event_id, hot_sheet_id, audience, recipient_key) and the email_jobs
 * idempotency_key unique index.
 */
import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { planHotSheetEventDelivery } from "./hotSheetEventClassification.ts";
import { getHotSheetStatusCopy } from "./hotSheetStatusCopy.ts";
import {
  agentIdempotencyKey,
  clientListingIdempotencyKey,
  eventScopedIdempotencyKey,
  subscriberListingIdempotencyKey,
} from "./hotSheetAgentDelivery.ts";

const LISTING = "11111111-1111-1111-1111-111111111111";
const HS = "22222222-2222-2222-2222-222222222222";
const SHEET = "Back Bay Condos";
const AGENT = "agent@example.com";
const CLIENT = "client-1";
const SUB = "sub-1";

type Ev = { id: string; listing_id: string; trigger_op: string; old_status: string | null; new_status: string };
const ev = (id: string, old_status: string | null, new_status: string, op = "UPDATE"): Ev => ({
  id, listing_id: LISTING, trigger_op: op, old_status, new_status,
});

type Job = { key: string; subject: string; status_at_send: string; event_id: string };

/** Mirrors enqueue_hot_sheet_delivery: claim key first, then job idempotency. */
function makeStore() {
  const claims = new Set<string>();
  const jobs = new Map<string, Job>();
  return {
    claims,
    jobs,
    enqueue(eventId: string, audience: string, recipient: string, job: Job): "enqueued" | "duplicate" {
      if (!eventId) throw new Error("event_id is required");
      const claimKey = [eventId, HS, audience, recipient.trim().toLowerCase()].join("|");
      if (claims.has(claimKey)) return "duplicate";
      claims.add(claimKey);
      if (!jobs.has(job.key)) jobs.set(job.key, job);
      return "enqueued";
    },
  };
}

/** Mirrors send-new-match-notification's per-event delivery decisions. */
function processEvent(store: ReturnType<typeof makeStore>, e: Ev, currentListingStatus: string) {
  const plan = planHotSheetEventDelivery(e, LISTING, currentListingStatus);
  if (plan.action === "skip") return { skipped: true, reason: plan.reason, jobsQueued: 0 };
  const status = plan.status; // event.new_status — authoritative
  const subject = plan.eventClass === "new_match"
    ? `New matches in your Hot Sheet: ${SHEET}`
    : getHotSheetStatusCopy(plan.statusKey).subject(SHEET);
  let jobsQueued = 0;
  const deliveries: Array<[string, string, string]> = [
    ["agent", AGENT, eventScopedIdempotencyKey(agentIdempotencyKey(HS, LISTING, status), e.id)],
    ["client", CLIENT, eventScopedIdempotencyKey(clientListingIdempotencyKey(CLIENT, HS, LISTING, status), e.id)],
    ["subscriber", SUB, eventScopedIdempotencyKey(subscriberListingIdempotencyKey(SUB, HS, LISTING, status), e.id)],
  ];
  for (const [audience, recipient, key] of deliveries) {
    const r = store.enqueue(e.id, audience, recipient, { key, subject, status_at_send: status, event_id: e.id });
    if (r === "enqueued") jobsQueued++;
  }
  return { skipped: false, reason: null, jobsQueued, status, subject };
}

const jobsFor = (store: ReturnType<typeof makeStore>, eventId: string) =>
  [...store.jobs.values()].filter((j) => j.event_id === eventId);

Deno.test("same event processed twice -> one email maximum per recipient", () => {
  const store = makeStore();
  const a = ev("ev-1", "active", "off_market");
  const first = processEvent(store, a, "off_market");
  const second = processEvent(store, a, "off_market");
  assertEquals(first.jobsQueued, 3);
  assertEquals(second.jobsQueued, 0);
  assertEquals(jobsFor(store, "ev-1").length, 3);
  // Idempotency key is stable for the same event.
  assertEquals(
    eventScopedIdempotencyKey(agentIdempotencyKey(HS, LISTING, "off_market"), "ev-1"),
    eventScopedIdempotencyKey(agentIdempotencyKey(HS, LISTING, "off_market"), "ev-1"),
  );
});

Deno.test("active -> off_market -> Off Market alert", () => {
  const store = makeStore();
  const r = processEvent(store, ev("ev-1", "active", "off_market"), "off_market");
  assertEquals(r.jobsQueued, 3);
  assertEquals(r.subject, `Off Market update in ${SHEET}`);
  assertEquals(r.status, "off_market");
  for (const j of jobsFor(store, "ev-1")) assertEquals(j.status_at_send, "off_market");
});

Deno.test("off_market -> active -> Now On MLS alert", () => {
  const store = makeStore();
  const r = processEvent(store, ev("ev-2", "off_market", "active"), "active");
  assertEquals(r.jobsQueued, 3);
  assertEquals(r.subject, `Now On MLS in ${SHEET}`);
  assertEquals(r.status, "active");
});

Deno.test("active -> off_market -> active -> off_market: second Off Market alert is allowed", () => {
  const store = makeStore();
  const r1 = processEvent(store, ev("ev-1", "active", "off_market"), "off_market");
  const r2 = processEvent(store, ev("ev-2", "off_market", "active"), "active");
  const r3 = processEvent(store, ev("ev-3", "active", "off_market"), "off_market");
  assertEquals([r1.jobsQueued, r2.jobsQueued, r3.jobsQueued], [3, 3, 3]);
  assertEquals(r3.subject, `Off Market update in ${SHEET}`);
  // Two distinct Off Market jobs for the agent, one per event.
  const agentOffMarket = [...store.jobs.values()].filter(
    (j) => j.key.startsWith("hs-agent:") && j.status_at_send === "off_market",
  );
  assertEquals(agentOffMarket.length, 2);
  assert(agentOffMarket[0].key !== agentOffMarket[1].key);
  // Replaying the later event is still a no-op.
  assertEquals(processEvent(store, ev("ev-3", "active", "off_market"), "off_market").jobsQueued, 0);
});

Deno.test("superseded old event -> zero jobs, never a stale subject", () => {
  const store = makeStore();
  // Old active->off_market event processed after the listing returned to active.
  const r = processEvent(store, ev("ev-1", "active", "off_market"), "active");
  assertEquals(r.skipped, true);
  assertEquals(r.reason, "event_superseded");
  assertEquals(r.jobsQueued, 0);
  assertEquals(store.jobs.size, 0);
  assertEquals(store.claims.size, 0);
});

Deno.test("event-scoped key requires an event id and leaves historical keys untouched", () => {
  assertThrows(() => eventScopedIdempotencyKey("hs-agent:x:y:active", ""));
  assertThrows(() => eventScopedIdempotencyKey("hs-agent:x:y:active", "   "));
  assertEquals(
    eventScopedIdempotencyKey(agentIdempotencyKey(HS, LISTING, "active"), "ev-9"),
    `hs-agent:${HS}:${LISTING}:active:ev:ev-9`,
  );
  // Base builders are unchanged (historical email_jobs keys stay valid).
  assertEquals(agentIdempotencyKey(HS, LISTING, "active"), `hs-agent:${HS}:${LISTING}:active`);
});

// Static guard on the matcher source.
Deno.test("matcher uses event-scoped keys everywhere and never gates on sent-state", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-new-match-notification/index.ts", import.meta.url),
  );
  // Every key builder call is wrapped with the event scope.
  const builders = [...src.matchAll(/(agentIdempotencyKey|clientListingIdempotencyKey|subscriberListingIdempotencyKey)\(/g)]
    .filter((m) => !/^\s*(agentIdempotencyKey|clientListingIdempotencyKey|subscriberListingIdempotencyKey),/.test(src.slice(m.index!)));
  const wrapped = [...src.matchAll(/eventScopedIdempotencyKey\(\s*(agentIdempotencyKey|clientListingIdempotencyKey|subscriberListingIdempotencyKey)\(/g)];
  assertEquals(builders.length, 6, "expected 6 delivery key sites");
  assertEquals(wrapped.length, builders.length, "every idempotency key must be event-scoped");
  // Claims carry the immutable event id.
  assertEquals((src.match(/eventId:\s*deliveryEventId,/g) || []).length, 6);
  assertEquals(/eventId:\s*triggerEventId/.test(src), false);
  // Criteria-only helper, scoped to the listing; no status-keyed matcher here.
  assert(src.includes('.rpc("hot_sheet_criteria_matches"'));
  assertEquals(src.includes('.rpc("check_hot_sheet_matches"'), false);
  // hot_sheet_sent_listings is written (upsert) but never read to skip.
  assertEquals(/from\("hot_sheet_sent_listings"\)\s*\.select/.test(src), false);
  assertEquals(src.includes("priorStatusesByListing"), false);
});
