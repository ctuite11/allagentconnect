import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  assertCommsEnqueueAllowed,
  assertHotSheetEnqueueAllowed,
  assertJobSendable,
  attemptsAfterPauseRaceRequeue,
  getClaimableStreams,
  HOT_SHEET_TEMPLATES,
  idempotencyKeyCollidesAcrossSystems,
  inferStreamFromTemplate,
  isCommsIdempotencyKey,
  isHotSheetIdempotencyKey,
  isHotSheetSyncedClientNeed,
  isJobClaimEligible,
  isPauseRaceBlock,
  isRetiredBroadListingJob,
  RETIRED_BROAD_LISTING_TEMPLATE,
} from "./emailStreams.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

Deno.test("11. global pause: nothing claimable / enqueue blocked", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "true",
      HOT_SHEET_EMAILS_PAUSED: "false",
      COMMS_EMAILS_PAUSED: "false",
    },
    () => {
      assertEquals(getClaimableStreams(), []);
      assertEquals(assertHotSheetEnqueueAllowed().paused, true);
      assertEquals(assertCommsEnqueueAllowed().paused, true);
      assertEquals(
        assertJobSendable({ stream: "hot_sheet", payload: { template: "new-match-notification" } }).ok,
        false,
      );
      assertEquals(
        assertJobSendable({ stream: "communications", payload: { template: "client-need-broadcast" } }).ok,
        false,
      );
    },
  );
});

Deno.test("12. Hot Sheet paused, Comms active → only Comms (+txn/system) claimable", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "false",
      HOT_SHEET_EMAILS_PAUSED: "true",
      COMMS_EMAILS_PAUSED: "false",
    },
    () => {
      assertEquals(getClaimableStreams().includes("hot_sheet"), false);
      assertEquals(getClaimableStreams().includes("communications"), true);
      assertEquals(assertHotSheetEnqueueAllowed().paused, true);
      assertEquals(assertCommsEnqueueAllowed().paused, false);
      assertEquals(
        assertJobSendable({ stream: "hot_sheet", payload: { template: "new-match-notification" } }).ok,
        false,
      );
      assertEquals(
        assertJobSendable({ stream: "communications", payload: { template: "client-need-broadcast" } }).ok,
        true,
      );
    },
  );
});

Deno.test("13. Comms paused, Hot Sheets active → only Hot Sheet (+txn/system) claimable", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "false",
      HOT_SHEET_EMAILS_PAUSED: "false",
      COMMS_EMAILS_PAUSED: "true",
    },
    () => {
      assertEquals(getClaimableStreams().includes("communications"), false);
      assertEquals(getClaimableStreams().includes("hot_sheet"), true);
      assertEquals(assertCommsEnqueueAllowed().paused, true);
      assertEquals(assertHotSheetEnqueueAllowed().paused, false);
    },
  );
});

Deno.test("14. paused stream job does not block other stream sendability checks", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "false",
      HOT_SHEET_EMAILS_PAUSED: "true",
      COMMS_EMAILS_PAUSED: "false",
    },
    () => {
      const hs = assertJobSendable({
        stream: "hot_sheet",
        payload: { template: "new-match-notification" },
      });
      const comms = assertJobSendable({
        stream: "communications",
        payload: { template: "client-need-broadcast" },
      });
      assertEquals(hs.ok, false);
      assertEquals(comms.ok, true);
    },
  );
});

Deno.test("15. Hot Sheet and Comms idempotency keys do not collide", () => {
  const hs = "hs-agent:hs1:L1:active";
  const comms = "comms:bcast1:buyer_need:agent1";
  const legacyComms = "client-need-broadcast:bcast1:agent1";
  assertEquals(isHotSheetIdempotencyKey(hs), true);
  assertEquals(isCommsIdempotencyKey(hs), false);
  assertEquals(isCommsIdempotencyKey(comms), true);
  assertEquals(isHotSheetIdempotencyKey(comms), false);
  assertEquals(isCommsIdempotencyKey(legacyComms), true);
  assertEquals(isHotSheetIdempotencyKey(legacyComms), false);
  assertEquals(idempotencyKeyCollidesAcrossSystems(hs), false);
  assertEquals(idempotencyKeyCollidesAcrossSystems(comms), false);
});

Deno.test("retired broad-listing template is not a Hot Sheet template", () => {
  assertEquals(HOT_SHEET_TEMPLATES.has(RETIRED_BROAD_LISTING_TEMPLATE), false);
  assertEquals(inferStreamFromTemplate(RETIRED_BROAD_LISTING_TEMPLATE), null);
  assertEquals(isHotSheetIdempotencyKey("agent-new-listing:listing-1:agent-1"), false);
});

Deno.test("retired broad-listing job cannot be claimed as hot_sheet", () => {
  const allowed = ["hot_sheet", "transactional", "system"] as const;
  assertEquals(
    isJobClaimEligible(
      {
        status: "queued",
        stream: "hot_sheet",
        payload: { template: "agent-new-listing-alert" },
        idempotency_key: "agent-new-listing:L1:A1",
      },
      allowed,
    ),
    false,
  );
  assertEquals(
    isJobClaimEligible(
      {
        status: "queued",
        stream: "hot_sheet",
        payload: { template: "new-match-notification" },
        idempotency_key: "other",
      },
      allowed,
    ),
    true,
  );
  // Idempotency marker alone is enough to quarantine.
  assertEquals(
    isJobClaimEligible(
      {
        status: "queued",
        stream: "transactional",
        payload: { template: "welcome-email" },
        idempotency_key: "agent-new-listing:L1:A1",
      },
      ["transactional"],
    ),
    false,
  );
});

Deno.test("retired broad-listing job cannot pass final send gate for any stream", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "false",
      HOT_SHEET_EMAILS_PAUSED: "false",
      COMMS_EMAILS_PAUSED: "false",
    },
    () => {
      for (const stream of [null, "hot_sheet", "transactional", "communications", "system"] as const) {
        const byTemplate = assertJobSendable({
          stream,
          payload: { template: "agent-new-listing-alert" },
        });
        assertEquals(byTemplate.ok, false);
        if (!byTemplate.ok) {
          assertEquals(byTemplate.reason, "retired_broad_listing");
        }

        const byKey = assertJobSendable({
          stream,
          idempotency_key: "agent-new-listing:listing-1:agent-1",
          payload: { template: "new-match-notification" },
        });
        assertEquals(byKey.ok, false);
        if (!byKey.ok) {
          assertEquals(byKey.reason, "retired_broad_listing");
        }
      }
      assertEquals(
        isRetiredBroadListingJob({
          stream: "hot_sheet",
          payload: { template: "agent-new-listing-alert" },
        }),
        true,
      );
    },
  );
});

Deno.test("unknown templates fail closed even when labeled transactional", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "false",
      HOT_SHEET_EMAILS_PAUSED: "false",
      COMMS_EMAILS_PAUSED: "false",
    },
    () => {
      const nullStream = assertJobSendable({
        stream: null,
        payload: { template: "totally-unknown-template" },
      });
      assertEquals(nullStream.ok, false);
      if (!nullStream.ok) assertEquals(nullStream.reason, "unknown_template");

      const txnLabeled = assertJobSendable({
        stream: "transactional",
        payload: { template: "totally-unknown-template" },
      });
      assertEquals(txnLabeled.ok, false);
      if (!txnLabeled.ok) assertEquals(txnLabeled.reason, "unknown_template");

      assertEquals(inferStreamFromTemplate("totally-unknown-template"), null);
    },
  );
});

Deno.test("stream/template mismatches fail closed", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "false",
      HOT_SHEET_EMAILS_PAUSED: "false",
      COMMS_EMAILS_PAUSED: "false",
    },
    () => {
      const cases = [
        { stream: "hot_sheet", template: "client-need-broadcast" },
        { stream: "communications", template: "new-match-notification" },
        { stream: "transactional", template: "seller-alert" },
      ] as const;

      for (const c of cases) {
        const r = assertJobSendable({
          stream: c.stream,
          payload: { template: c.template },
        });
        assertEquals(r.ok, false);
        if (!r.ok) {
          assertEquals(r.reason, "stream_template_mismatch");
          assertEquals(r.error.includes(`stream="${c.stream}"`), true);
          assertEquals(r.error.includes(`template="${c.template}"`), true);
        }
      }
    },
  );
});

Deno.test("pause races do not consume max_attempts", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "false",
      HOT_SHEET_EMAILS_PAUSED: "true",
      COMMS_EMAILS_PAUSED: "false",
    },
    () => {
      const maxAttempts = 3;
      let attempts = 0;
      // Simulate repeated claim → pause-gate → requeue cycles.
      for (let i = 0; i < 10; i++) {
        attempts += 1; // claim increments
        const gate = assertJobSendable({
          stream: "hot_sheet",
          payload: { template: "new-match-notification" },
        });
        assertEquals(gate.ok, false);
        if (!gate.ok) {
          assertEquals(isPauseRaceBlock(gate), true);
          attempts = attemptsAfterPauseRaceRequeue(attempts);
        }
      }
      assertEquals(attempts, 0);
      assertEquals(attempts < maxAttempts, true);
    },
  );
});

Deno.test("unclassified / empty template fails closed", () => {
  withEnv({ EMAIL_SENDING_PAUSED: "false" }, () => {
    const r = assertJobSendable({ stream: null, payload: { template: undefined } });
    assertEquals(r.ok, false);
  });
});

Deno.test("Hot-Sheet-synced client_need descriptions are detected", () => {
  assertEquals(
    isHotSheetSyncedClientNeed("Auto-generated from hot sheet: Boston Condos"),
    true,
  );
  assertEquals(isHotSheetSyncedClientNeed("Looking for 3br in Boston"), false);
});

Deno.test("6. Comms prefs disabled does not affect Hot Sheet pause gate", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "false",
      HOT_SHEET_EMAILS_PAUSED: "false",
      COMMS_EMAILS_PAUSED: "true",
    },
    () => {
      assertEquals(assertHotSheetEnqueueAllowed().paused, false);
    },
  );
});

Deno.test("global pause defaults to paused when unset (fail closed)", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: undefined,
      HOT_SHEET_EMAILS_PAUSED: "false",
      COMMS_EMAILS_PAUSED: "false",
    },
    () => {
      assertEquals(getClaimableStreams(), []);
    },
  );
});
