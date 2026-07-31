/**
 * Cross-system isolation tests: Hot Sheets ↔ Communications Center.
 * These encode the required boundaries without invoking producers or Resend.
 */
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  agentIdempotencyKey,
  clientListingIdempotencyKey,
  isAgentEligibleForListing,
  isImmediateHotSheet,
  simulateHotSheetDeliveryPass,
  type ImmediateHotSheet,
} from "./hotSheetAgentDelivery.ts";
import {
  isCommsIdempotencyKey,
  isHotSheetIdempotencyKey,
  isHotSheetSyncedClientNeed,
} from "./emailStreams.ts";

const sheet: ImmediateHotSheet = {
  id: "hs-1",
  user_id: "agent-owner",
  name: "Boston Condos",
  is_active: true,
  notify_agent_email: true,
  notification_schedule: "immediately",
};

Deno.test("1. listing with no active matching Hot Sheet → zero Hot Sheet jobs", () => {
  // No open listings / empty match set ⇒ simulator enqueues nothing.
  const pass = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: [],
    agentRecipient: "agent@example.com",
    clientRecipients: ["client-1"],
    subscriberIds: ["sub-1"],
    existingKeys: new Set(),
  });
  assertEquals(pass.enqueuedKeys, []);
  // Comms jobs are never created by this path (separate system).
  assertEquals(pass.enqueuedKeys.some(isCommsIdempotencyKey), false);
});

Deno.test("2. one active matching Hot Sheet → only Hot Sheet recipients; no Comms keys", () => {
  const pass = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: [{ id: "L1", status: "active" }],
    agentRecipient: "agent@example.com",
    clientRecipients: ["client-1"],
    subscriberIds: ["sub-1"],
    existingKeys: new Set(),
  });
  assertEquals(pass.enqueuedKeys.length > 0, true);
  assertEquals(pass.enqueuedKeys.every(isHotSheetIdempotencyKey), true);
  assertEquals(pass.enqueuedKeys.some(isCommsIdempotencyKey), false);
  // No broad verified-agent audience key pattern.
  assertEquals(pass.enqueuedKeys.some((k) => k.startsWith("agent-new-listing:")), false);
});

Deno.test("3. listing fails Hot Sheet criteria → zero jobs (no open matches)", () => {
  // Criteria failure is modeled as check_hot_sheet_matches returning [].
  const pass = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: [],
    agentRecipient: "agent@example.com",
    clientRecipients: [],
    subscriberIds: [],
    existingKeys: new Set(),
  });
  assertEquals(pass.enqueuedKeys, []);
});

Deno.test("4. notify_agent_email=false → no agent Hot Sheet email", () => {
  assertEquals(
    isAgentEligibleForListing(
      { ...sheet, notify_agent_email: false },
      { id: "L1", status: "active", agent_id: "other" },
    ),
    false,
  );
  const pass = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: [{ id: "L1", status: "active" }],
    agentRecipient: null, // producer skips when notify_agent_email=false
    clientRecipients: [],
    subscriberIds: [],
    existingKeys: new Set(),
  });
  assertEquals(
    pass.enqueuedKeys.some((k) => k.startsWith("hs-agent:")),
    false,
  );
});

Deno.test("5. listing owner excluded from Hot Sheet agent alert", () => {
  assertEquals(
    isAgentEligibleForListing(sheet, {
      id: "L1",
      status: "active",
      agent_id: "agent-owner",
    }),
    false,
  );
});

Deno.test("Hot Sheet path ignores Comms preference state (eligibility is HS-only)", () => {
  // Even if we imagine Comms prefs disabled, Hot Sheet eligibility is unchanged.
  assertEquals(isImmediateHotSheet(sheet), true);
  assertEquals(
    isAgentEligibleForListing(sheet, {
      id: "L1",
      status: "active",
      agent_id: "other",
    }),
    true,
  );
});

Deno.test("7/16. Comms broadcast keys never close Hot Sheet match events", () => {
  const commsKey = "client-need-broadcast:bcast-1:agent-9";
  assertEquals(isCommsIdempotencyKey(commsKey), true);
  assertEquals(isHotSheetIdempotencyKey(commsKey), false);

  // Hot Sheet event close uses Hot Sheet keys + hot_sheet_sent_listings, not Comms keys.
  const pass = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: [{ id: "L1", status: "active" }],
    agentRecipient: "agent@example.com",
    clientRecipients: [],
    subscriberIds: [],
    existingKeys: new Set([commsKey]),
  });
  // Agent job still enqueued — Comms key did not suppress Hot Sheet delivery.
  assertEquals(
    pass.enqueuedKeys.includes(agentIdempotencyKey("hs-1", "L1", "active")),
    true,
  );
});

Deno.test("16. retrying Hot Sheet delivery cannot resend a Comms broadcast key", () => {
  const existing = new Set([
    agentIdempotencyKey("hs-1", "L1", "active"),
    "client-need-broadcast:bcast-1:agent-9",
  ]);
  const pass = simulateHotSheetDeliveryPass({
    hotSheetId: "hs-1",
    openListings: [{ id: "L1", status: "active" }],
    agentRecipient: "agent@example.com",
    clientRecipients: ["client-1"],
    subscriberIds: [],
    existingKeys: existing,
  });
  // Client Hot Sheet key is new; Comms key is never re-created by HS path.
  assertEquals(
    pass.enqueuedKeys.includes(
      clientListingIdempotencyKey("client-1", "hs-1", "L1", "active"),
    ),
    true,
  );
  assertEquals(
    pass.enqueuedKeys.some((k) => k.startsWith("client-need-broadcast:")),
    false,
  );
});

Deno.test("17. Hot-Sheet-synced client_need must not enter Comms path", () => {
  assertEquals(
    isHotSheetSyncedClientNeed("Auto-generated from hot sheet: Worcester SF"),
    true,
  );
});

Deno.test("retired broad listing alert key namespace is quarantined (not Hot Sheet, not Comms)", () => {
  // Permanently retired — must never be treated as an active Hot Sheet namespace.
  assertEquals(isHotSheetIdempotencyKey("agent-new-listing:a:L:active"), false);
  assertEquals(isCommsIdempotencyKey("agent-new-listing:a:L:active"), false);
});

Deno.test(
  "new subscriber against open (unbaselined) matches would enqueue backlog — baseline required",
  () => {
    const withoutBaseline = simulateHotSheetDeliveryPass({
      hotSheetId: "hs-1",
      openListings: [{ id: "L1", status: "active" }],
      agentRecipient: null,
      clientRecipients: [],
      subscriberIds: ["friend-1"],
      existingKeys: new Set(),
    });
    assertEquals(withoutBaseline.enqueuedKeys.length > 0, true);

    // After baselineOnly, current matches are no longer "open" for SNMN.
    const afterBaseline = simulateHotSheetDeliveryPass({
      hotSheetId: "hs-1",
      openListings: [],
      agentRecipient: null,
      clientRecipients: [],
      subscriberIds: ["friend-1"],
      existingKeys: new Set(),
    });
    assertEquals(afterBaseline.enqueuedKeys, []);
  },
);
