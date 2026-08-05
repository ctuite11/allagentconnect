import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  agentIdempotencyKey,
  clientListingIdempotencyKey,
  filterMatchesToRequestedListing,
  hasClientsPendingAcceptance,
  isAgentEligibleForListing,
  isImmediateHotSheet,
  mergeRecipientOutcomes,
  parseRequiredListingId,
  shouldCloseMatchEvent,
  simulateHotSheetDeliveryPass,
  subscriberListingIdempotencyKey,
  type ImmediateHotSheet,
} from "./hotSheetAgentDelivery.ts";

const baseSheet: ImmediateHotSheet = {
  id: "hs-1",
  user_id: "agent-owner",
  name: "Boston Condos",
  is_active: true,
  notify_agent_email: true,
  notification_schedule: "immediately",
};

Deno.test("1. agent with zero active Hot Sheets → no eligibility surface", () => {
  assertEquals(isImmediateHotSheet({ ...baseSheet, is_active: false }), false);
});

Deno.test("2. paused / non-immediate Hot Sheets are excluded from immediate path", () => {
  assertEquals(
    isImmediateHotSheet({ ...baseSheet, notification_schedule: "daily" }),
    false,
  );
  assertEquals(
    isImmediateHotSheet({ ...baseSheet, notification_schedule: "weekly" }),
    false,
  );
});

Deno.test("3/6. notify_agent_email=false → no agent email", () => {
  assertEquals(
    isAgentEligibleForListing(
      { ...baseSheet, notify_agent_email: false },
      { id: "L1", status: "active", agent_id: "other-agent" },
    ),
    false,
  );
});

Deno.test("5. agent-only Hot Sheet can notify owner when enabled", () => {
  assertEquals(
    isAgentEligibleForListing(baseSheet, {
      id: "L1",
      status: "active",
      agent_id: "other-agent",
    }),
    true,
  );
});

Deno.test("7. digest Hot Sheets do not send through immediate path", () => {
  assertEquals(
    isAgentEligibleForListing(
      { ...baseSheet, notification_schedule: "daily" },
      { id: "L1", status: "active", agent_id: "other-agent" },
    ),
    false,
  );
});

Deno.test("8. listing's own agent does not receive their own listing alert", () => {
  assertEquals(
    isAgentEligibleForListing(baseSheet, {
      id: "L1",
      status: "active",
      agent_id: "agent-owner",
    }),
    false,
  );
});

Deno.test("10. agent idempotency key is per hot sheet / listing / status", () => {
  assertEquals(
    agentIdempotencyKey("hs-1", "L1", "active"),
    "hs-agent:hs-1:L1:active",
  );
  assertEquals(
    agentIdempotencyKey("hs-1", "L1", "price_changed") ===
      agentIdempotencyKey("hs-1", "L1", "active"),
    false,
  );
});

Deno.test("client/subscriber keys are per recipient / listing / status", () => {
  assertEquals(
    clientListingIdempotencyKey("client-1", "hs-1", "A", "active"),
    "hs:client-1:hs:hs-1:listing:A:active",
  );
  assertEquals(
    subscriberListingIdempotencyKey("sub-1", "hs-1", "B", "pending"),
    "hss:sub-1:hs:hs-1:listing:B:pending",
  );
});

Deno.test("11. failed agent enqueue remains retryable after client success", () => {
  assertEquals(
    shouldCloseMatchEvent({
      agent: "failed",
      client: "success",
      subscriber: "skipped",
      clientsPendingAcceptance: false,
    }),
    false,
  );
});

Deno.test("successful agent must not close event when client failed", () => {
  assertEquals(
    shouldCloseMatchEvent({
      agent: "success",
      client: "failed",
      subscriber: "skipped",
      clientsPendingAcceptance: false,
    }),
    false,
  );
});

Deno.test("9. client acceptance pending keeps event open (client-only gate)", () => {
  assertEquals(
    shouldCloseMatchEvent({
      agent: "success",
      client: "skipped",
      subscriber: "skipped",
      clientsPendingAcceptance: true,
    }),
    false,
  );
});

Deno.test("agent-only success closes event when no clients pending", () => {
  assertEquals(
    shouldCloseMatchEvent({
      agent: "success",
      client: "skipped",
      subscriber: "skipped",
      clientsPendingAcceptance: false,
    }),
    true,
  );
});

Deno.test("all recipient types success closes event", () => {
  assertEquals(
    shouldCloseMatchEvent({
      agent: "success",
      client: "success",
      subscriber: "success",
      clientsPendingAcceptance: false,
    }),
    true,
  );
});

Deno.test("mixed accepted/unaccepted clients keep event pending", () => {
  assertEquals(
    hasClientsPendingAcceptance({ assignedCount: 2, acceptedCount: 1 }),
    true,
  );
  assertEquals(
    hasClientsPendingAcceptance({ assignedCount: 2, acceptedCount: 0 }),
    true,
  );
  assertEquals(
    hasClientsPendingAcceptance({ assignedCount: 2, acceptedCount: 2 }),
    false,
  );
  assertEquals(
    hasClientsPendingAcceptance({ assignedCount: 0, acceptedCount: 0 }),
    false,
  );
  // Lookup failure must not be treated as "no clients"
  assertEquals(
    hasClientsPendingAcceptance({
      assignedCount: 0,
      acceptedCount: 0,
      lookupFailed: true,
    }),
    false,
  );
});

Deno.test("mergeRecipientOutcomes: any failure wins", () => {
  assertEquals(mergeRecipientOutcomes(["success", "failed"]), "failed");
  assertEquals(mergeRecipientOutcomes(["success", "skipped"]), "success");
  assertEquals(mergeRecipientOutcomes(["skipped", "skipped"]), "skipped");
});

Deno.test("partial agent failure does not duplicate client/subscriber on retry", () => {
  const listings = [
    { id: "A", status: "active" },
    { id: "B", status: "active" },
  ];

  const pass1 = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: listings,
    agentRecipient: "agent@example.com",
    clientRecipients: ["client-1"],
    subscriberIds: ["sub-1"],
    existingKeys: new Set(),
    failAgentListingIds: new Set(["B"]),
  });

  // A closes; B stays open because agent failed for B.
  assertEquals(pass1.closedListingIds, ["A"]);
  assertEquals(pass1.remainingOpenListingIds, ["B"]);

  const clientKeyA = clientListingIdempotencyKey("client-1", "hs-1", "A", "active");
  const clientKeyB = clientListingIdempotencyKey("client-1", "hs-1", "B", "active");
  const subKeyA = subscriberListingIdempotencyKey("sub-1", "hs-1", "A", "active");
  const subKeyB = subscriberListingIdempotencyKey("sub-1", "hs-1", "B", "active");
  assertEquals(pass1.existingKeys.has(clientKeyA), true);
  assertEquals(pass1.existingKeys.has(clientKeyB), true);
  assertEquals(pass1.existingKeys.has(subKeyA), true);
  assertEquals(pass1.existingKeys.has(subKeyB), true);

  const pass2 = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: listings.filter((l) => pass1.remainingOpenListingIds.includes(l.id)),
    agentRecipient: "agent@example.com",
    clientRecipients: ["client-1"],
    subscriberIds: ["sub-1"],
    existingKeys: pass1.existingKeys,
    failAgentListingIds: new Set(),
  });

  // Retry only enqueues the failed agent job for B.
  assertEquals(pass2.enqueuedKeys, [agentIdempotencyKey("hs-1", "B", "active")]);
  assertEquals(pass2.closedListingIds, ["B"]);
  assertEquals(pass2.remainingOpenListingIds, []);
});

Deno.test("mixed acceptance: event stays open until second client accepts", () => {
  const listings = [{ id: "A", status: "active" }];

  const pass1 = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: listings,
    agentRecipient: "agent@example.com",
    clientRecipients: ["client-accepted"],
    pendingClientRecipients: ["client-pending"],
    subscriberIds: [],
    existingKeys: new Set(),
  });

  assertEquals(pass1.closedListingIds, []);
  assertEquals(pass1.remainingOpenListingIds, ["A"]);
  assertEquals(
    pass1.existingKeys.has(
      clientListingIdempotencyKey("client-accepted", "hs-1", "A", "active"),
    ),
    true,
  );

  const pass2 = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: listings,
    agentRecipient: "agent@example.com",
    clientRecipients: ["client-accepted", "client-pending"],
    pendingClientRecipients: [],
    subscriberIds: [],
    existingKeys: pass1.existingKeys,
  });

  // Only the newly accepted client is enqueued; first client is not duplicated.
  assertEquals(pass2.enqueuedKeys, [
    clientListingIdempotencyKey("client-pending", "hs-1", "A", "active"),
  ]);
  assertEquals(pass2.closedListingIds, ["A"]);
});

Deno.test("client lookup failure blocks event close even if agent succeeds", () => {
  const pass = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: [{ id: "A", status: "active" }],
    agentRecipient: "agent@example.com",
    clientRecipients: [],
    subscriberIds: [],
    existingKeys: new Set(),
    clientLookupFailed: true,
  });
  assertEquals(pass.closedListingIds, []);
  assertEquals(pass.remainingOpenListingIds, ["A"]);
  assertEquals(pass.enqueuedKeys, [agentIdempotencyKey("hs-1", "A", "active")]);
});

Deno.test("subscriber lookup failure blocks event close even if agent succeeds", () => {
  const pass = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: [{ id: "A", status: "active" }],
    agentRecipient: "agent@example.com",
    clientRecipients: [],
    subscriberIds: [],
    existingKeys: new Set(),
    subscriberLookupFailed: true,
  });
  assertEquals(pass.closedListingIds, []);
  assertEquals(pass.remainingOpenListingIds, ["A"]);
});

Deno.test("requested listing match keeps only that listing from RPC results", () => {
  const rpc = [
    { listing_id: "L-requested" },
    { listing_id: "L-unrelated-1" },
    { listing_id: "L-unrelated-2" },
  ];
  const scoped = filterMatchesToRequestedListing(rpc, "L-requested");
  assertEquals(scoped.map((m) => m.listing_id), ["L-requested"]);
});

Deno.test("RPC with requested listing plus unrelated unsent → unrelated create zero candidates", () => {
  const rpc = [
    { listing_id: "L1" },
    { listing_id: "L2" },
    { listing_id: "L3" },
  ];
  const scoped = filterMatchesToRequestedListing(rpc, "L2");
  assertEquals(scoped.length, 1);
  assertEquals(scoped[0].listing_id, "L2");
  // Unrelated IDs never become delivery candidates / sent-state keys.
  const candidateIds = new Set(scoped.map((m) => String(m.listing_id)));
  assertEquals(candidateIds.has("L1"), false);
  assertEquals(candidateIds.has("L3"), false);
  assertEquals(
    [...candidateIds].flatMap((id) => [
      agentIdempotencyKey("hs-1", id, "active"),
    ]),
    [agentIdempotencyKey("hs-1", "L2", "active")],
  );
});

Deno.test("requested listing does not match → zero candidates", () => {
  const rpc = [{ listing_id: "L-other-a" }, { listing_id: "L-other-b" }];
  assertEquals(filterMatchesToRequestedListing(rpc, "L-requested"), []);
  assertEquals(filterMatchesToRequestedListing(null, "L-requested"), []);
  assertEquals(filterMatchesToRequestedListing(undefined, "L-requested"), []);
});

Deno.test("parseRequiredListingId rejects missing/blank listing_id", () => {
  assertEquals(parseRequiredListingId(undefined), null);
  assertEquals(parseRequiredListingId(null), null);
  assertEquals(parseRequiredListingId(""), null);
  assertEquals(parseRequiredListingId("   "), null);
  assertEquals(parseRequiredListingId("abc-123"), "abc-123");
});
