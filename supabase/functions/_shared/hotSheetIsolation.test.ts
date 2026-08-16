import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertHotSheetEnqueueAllowed,
  isPermanentlyBlockedJob,
  isRetiredBroadListingJob,
  preSendBlockReason,
} from "./emailStreams.ts";
import {
  agentIdempotencyKey,
  isAgentEligibleForListing,
} from "./hotSheetAgentDelivery.ts";
import { ALL_PAUSES_OFF, withEnv } from "./testEnv.ts";

Deno.test("agent Hot Sheet jobs use hot_sheet stream + new-match-notification template", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-new-match-notification/index.ts", import.meta.url),
  );
  // The hot_sheet stream is now stamped inside enqueue_hot_sheet_delivery, in
  // the same transaction as the delivery claim, instead of by the caller.
  assertEquals(src.includes("enqueueHotSheetDelivery"), true);
  assertEquals(src.includes('from("email_jobs")'), false);
  assertEquals(src.includes('template: "new-match-notification"'), true);
  assertEquals(src.includes('audience: "agent"'), true);
  assertEquals(src.includes("agent-new-listing-alert"), false);
  assertEquals(src.includes("assertHotSheetEnqueueAllowed"), true);
  assertEquals(src.includes("isAgentEligibleForListing"), true);
  assertEquals(src.includes("shouldCloseMatchEvent"), true);
  assertEquals(src.includes("agentIdempotencyKey"), true);
});

Deno.test("legitimate agent Hot Sheet jobs are not blocked as retired broad alerts", () => {
  // Pin every pause switch: preSendBlockReason consults the live environment,
  // so this assertion must not depend on the ambient pause state.
  withEnv(ALL_PAUSES_OFF, () => {
  const key = agentIdempotencyKey("hs-1", "listing-1", "active");
  assertEquals(isPermanentlyBlockedJob("new-match-notification", key), false);
  assertEquals(
    isRetiredBroadListingJob({
      stream: "hot_sheet",
      idempotency_key: key,
      payload: { template: "new-match-notification" },
    }),
    false,
  );
  assertEquals(
    preSendBlockReason({
      stream: "hot_sheet",
      idempotency_key: key,
      payload: { template: "new-match-notification" },
    }),
    null,
  );

  // Retired broad alerts remain blocked.
  assertEquals(isPermanentlyBlockedJob("agent-new-listing-alert", "x"), true);
  assertEquals(
    preSendBlockReason({
      stream: "hot_sheet",
      idempotency_key: "agent-new-listing:abc",
      payload: { template: "agent-new-listing-alert" },
    }),
    "permanently_retired_listing_alert",
  );
  });
});

Deno.test("agents without matching Hot Sheet eligibility receive nothing", () => {
  assertEquals(
    isAgentEligibleForListing(
      {
        id: "hs",
        user_id: "owner",
        name: "Sheet",
        notify_agent_email: false,
        notification_schedule: "immediately",
        is_active: true,
      },
      { id: "L1", agent_id: "other", status: "active" },
    ),
    false,
  );
  assertEquals(
    isAgentEligibleForListing(
      {
        id: "hs",
        user_id: "owner",
        name: "Sheet",
        notify_agent_email: true,
        notification_schedule: "daily",
        is_active: true,
      },
      { id: "L1", agent_id: "other", status: "active" },
    ),
    false,
  );
});

Deno.test("client acceptance gating remains intact in matcher source order", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-new-match-notification/index.ts", import.meta.url),
  );
  const agentIdx = src.indexOf("Agent delivery (before any client-only early exits)");
  const clientIdx = src.indexOf("Client delivery (acceptance gates apply ONLY here)");
  assertEquals(agentIdx > 0, true);
  assertEquals(clientIdx > agentIdx, true);
  assertEquals(src.includes("hasClientsPendingAcceptance"), true);
  assertEquals(src.includes("accepted_at"), true);
});

Deno.test("duplicate listing/status events use per-listing agent idempotency", () => {
  assertEquals(
    agentIdempotencyKey("hs", "L1", "active"),
    "hs-agent:hs:L1:active",
  );
  assertEquals(
    agentIdempotencyKey("hs", "L1", "active") ===
      agentIdempotencyKey("hs", "L1", "pending"),
    false,
  );
});

Deno.test("Hot Sheets do not write or send through client_needs", async () => {
  const matcher = await Deno.readTextFile(
    new URL("../send-new-match-notification/index.ts", import.meta.url),
  );
  const bridge = await Deno.readTextFile(
    new URL("../notify-matching-buyers/index.ts", import.meta.url),
  );
  // The bridge's response construction now lives in its extracted fanout core.
  const fanout = await Deno.readTextFile(
    new URL("../notify-matching-buyers/fanout.ts", import.meta.url),
  );
  assertEquals(matcher.includes("client_needs"), false);
  assertEquals(bridge.includes('.from("client_needs")'), false);
  // No legacy fan-out enqueue (comment mentions are fine; live template enqueue is not).
  assertEquals(bridge.includes('template: "new-listing-alert"'), false);
  assertEquals(bridge.includes("payload: { template: \"new-listing-alert\""), false);
  assertEquals(fanout.includes('template: "new-listing-alert"'), false);
  assertEquals(
    fanout.includes('legacy_client_needs_emails: "disabled_for_isolation"'),
    true,
  );
  assertEquals(bridge.includes("send-new-match-notification"), true);
  assertEquals(bridge.includes('functions.invoke("notify-agents-new-listing"'), false);
});

Deno.test("notify-agents-new-listing remains permanently hard-disabled with 410", async () => {
  const src = await Deno.readTextFile(
    new URL("../notify-agents-new-listing/index.ts", import.meta.url),
  );
  assertEquals(src.includes("status: 410"), true);
  assertEquals(src.includes("Permanently disabled"), true);
});

Deno.test("assertHotSheetEnqueueAllowed honors HOT_SHEET_EMAILS_PAUSED", () => {
  withEnv(
    { ...ALL_PAUSES_OFF, HOT_SHEET_EMAILS_PAUSED: "true" },
    () => {
    const paused = assertHotSheetEnqueueAllowed();
    assertEquals(paused.paused, true);
    assertEquals(paused.paused && paused.switch, "HOT_SHEET_EMAILS_PAUSED");
    },
  );
  withEnv(ALL_PAUSES_OFF, () => {
    assertEquals(assertHotSheetEnqueueAllowed().paused, false);
  });
  withEnv({ ...ALL_PAUSES_OFF, EMAIL_SENDING_PAUSED: "true" }, () => {
    const paused = assertHotSheetEnqueueAllowed();
    assertEquals(paused.paused && paused.switch, "EMAIL_SENDING_PAUSED");
  });
});

Deno.test("near-realtime matcher requires listing_id and scopes RPC matches", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-new-match-notification/index.ts", import.meta.url),
  );
  const bridge = await Deno.readTextFile(
    new URL("../notify-matching-buyers/index.ts", import.meta.url),
  );

  assertEquals(src.includes("parseRequiredListingId"), true);
  assertEquals(src.includes("filterMatchesToRequestedListing"), true);
  assertEquals(src.includes('reason: "listing_id required"'), true);
  assertEquals(src.includes("processed: 0"), true);
  assertEquals(src.includes("status: 400"), true);
  // No unauthenticated full-scan fallback.
  assertEquals(src.includes("cron invocations have no body"), false);
  assertEquals(src.includes(".in(\"id\", listingIds)"), false);
  assertEquals(src.includes('.eq("id", triggerListingId)'), true);

  // Bridge continues to pass the triggering listing_id.
  assertEquals(bridge.includes("listingId: listing.listing_id"), true);
});
