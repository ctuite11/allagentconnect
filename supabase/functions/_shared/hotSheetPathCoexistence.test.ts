/**
 * Transition guards for the period where BOTH delivery paths are live:
 *   legacy: trigger -> dispatch_hot_sheet_listing (pg_net) -> notify-matching-buyers
 *   outbox: hot_sheet_listing_events -> process-hot-sheet-events
 * Both must funnel through enqueue_hot_sheet_delivery so neither can
 * double-deliver nor bypass the logical delivery claim.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const matcher = await Deno.readTextFile(
  new URL("../send-new-match-notification/index.ts", import.meta.url),
);
const bridge = await Deno.readTextFile(
  new URL("../notify-matching-buyers/index.ts", import.meta.url),
);
const worker = await Deno.readTextFile(
  new URL("../process-hot-sheet-events/index.ts", import.meta.url),
);

Deno.test("matcher never inserts email_jobs directly — every enqueue is claimed", () => {
  assertEquals(matcher.includes('from("email_jobs")'), false);
  assertEquals(matcher.includes("enqueueHotSheetDelivery"), true);
  // One claimed enqueue per audience surface (agent x2, client x2, subscriber x2).
  assertEquals(matcher.split("enqueueHotSheetDelivery(supabase").length - 1, 6);
});

Deno.test("legacy pg_net payload contract {listing_id} is still accepted by the bridge", () => {
  // dispatch_hot_sheet_listing posts body jsonb_build_object('listing_id', ...).
  assertEquals(bridge.includes("listing.listing_id"), true);
  assertEquals(bridge.includes("listing_id: listingId"), true);
});

Deno.test("legacy path supplies no event_id and cannot complete an outbox event", () => {
  // Only the lease-holding worker may reach the terminal-state RPCs.
  assertEquals(matcher.includes("complete_hot_sheet_event"), false);
  assertEquals(matcher.includes("fail_hot_sheet_event"), false);
  assertEquals(matcher.includes("claim_hot_sheet_events"), false);
  assertEquals(worker.includes("complete_hot_sheet_event"), true);
  assertEquals(worker.includes("fail_hot_sheet_event"), true);
  // event_id is optional and defaults to null on the legacy path.
  assertEquals(matcher.includes("triggerEventId = rawEventId.length > 0 ? rawEventId : null"), true);
});

Deno.test("both paths call the same matcher, so both cross the same claim boundary", () => {
  assertEquals(bridge.includes('functions.invoke("send-new-match-notification"'), true);
  assertEquals(worker.includes('"send-new-match-notification"'), true);
});

Deno.test("worker refuses to claim while Hot Sheets are paused", () => {
  assertEquals(worker.includes("assertHotSheetEnqueueAllowed"), true);
  const workerCore = Deno.readTextFileSync(
    new URL("../process-hot-sheet-events/worker.ts", import.meta.url),
  );
  const pauseIdx = workerCore.indexOf("if (pauseGate.paused)");
  const claimIdx = workerCore.indexOf("await claimEvents(");
  assertEquals(pauseIdx > 0 && claimIdx > pauseIdx, true);
});

Deno.test("worker and matcher are internal service-role only", () => {
  assertEquals(worker.includes("authorizeInternalServiceRole"), true);
  assertEquals(matcher.includes("authorizeInternalServiceRole"), true);
  assertEquals(bridge.includes("authorizeInternalServiceRole"), true);
});
