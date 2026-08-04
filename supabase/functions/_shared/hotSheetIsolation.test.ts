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

Deno.test("agent Hot Sheet jobs use hot_sheet stream + new-match-notification template", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-new-match-notification/index.ts", import.meta.url),
  );
  assertEquals(src.includes('stream: "hot_sheet"'), true);
  assertEquals(src.includes('template: "new-match-notification"'), true);
  assertEquals(src.includes('audience: "agent"'), true);
  assertEquals(src.includes("agent-new-listing-alert"), false);
  assertEquals(src.includes("assertHotSheetEnqueueAllowed"), true);
  assertEquals(src.includes("isAgentEligibleForListing"), true);
  assertEquals(src.includes("shouldCloseMatchEvent"), true);
  assertEquals(src.includes("agentIdempotencyKey"), true);
});

Deno.test("legitimate agent Hot Sheet jobs are not blocked as retired broad alerts", () => {
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
  assertEquals(matcher.includes("client_needs"), false);
  assertEquals(bridge.includes('.from("client_needs")'), false);
  // No legacy fan-out enqueue (comment mentions are fine; live template enqueue is not).
  assertEquals(bridge.includes('template: "new-listing-alert"'), false);
  assertEquals(bridge.includes("payload: { template: \"new-listing-alert\""), false);
  assertEquals(bridge.includes('legacy_client_needs_emails: "disabled_for_isolation"'), true);
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
  const prevGlobal = Deno.env.get("EMAIL_SENDING_PAUSED");
  const prevHs = Deno.env.get("HOT_SHEET_EMAILS_PAUSED");
  try {
    Deno.env.set("EMAIL_SENDING_PAUSED", "false");
    Deno.env.set("HOT_SHEET_EMAILS_PAUSED", "true");
    const paused = assertHotSheetEnqueueAllowed();
    assertEquals(paused.paused, true);
    if (paused.paused) assertEquals(paused.switch, "HOT_SHEET_EMAILS_PAUSED");

    Deno.env.set("HOT_SHEET_EMAILS_PAUSED", "false");
    assertEquals(assertHotSheetEnqueueAllowed().paused, false);
  } finally {
    if (prevGlobal === undefined) Deno.env.delete("EMAIL_SENDING_PAUSED");
    else Deno.env.set("EMAIL_SENDING_PAUSED", prevGlobal);
    if (prevHs === undefined) Deno.env.delete("HOT_SHEET_EMAILS_PAUSED");
    else Deno.env.set("HOT_SHEET_EMAILS_PAUSED", prevHs);
  }
});
