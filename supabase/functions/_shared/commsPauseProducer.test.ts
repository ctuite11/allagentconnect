/**
 * Producer-side Communications pause gate.
 *
 * While Communications email is paused, Buyer Need producers must create
 * ZERO email_jobs, ZERO digest items and ZERO sent/dedup rows — while the
 * in-app broadcast row is still allowed through.
 */
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  assertCommsEnqueueAllowed,
  assertHotSheetEnqueueAllowed,
  preSendBlockReason,
} from "./emailStreams.ts";
import { evaluateCommsOptIn } from "./commsOptIn.ts";
import { ALL_PAUSES_OFF, withEnv } from "./testEnv.ts";

Deno.test("comms pause blocks the producer via COMMS_EMAILS_PAUSED", () => {
  withEnv({ ...ALL_PAUSES_OFF, COMMS_EMAILS_PAUSED: "true" }, () => {
    const gate = assertCommsEnqueueAllowed();
    assertEquals(gate.paused, true);
    assertEquals(gate.paused && gate.switch, "COMMS_EMAILS_PAUSED");
  });
});

Deno.test("comms pause blocks the producer via the global switch", () => {
  withEnv({ ...ALL_PAUSES_OFF, EMAIL_SENDING_PAUSED: "true" }, () => {
    const gate = assertCommsEnqueueAllowed();
    assertEquals(gate.paused, true);
    assertEquals(gate.paused && gate.switch, "EMAIL_SENDING_PAUSED");
  });
});

Deno.test("producer proceeds only when both switches are off", () => {
  withEnv({ ...ALL_PAUSES_OFF }, () => {
    assertEquals(assertCommsEnqueueAllowed().paused, false);
  });
});

Deno.test("comms pause leaves Hot Sheet and transactional streams untouched", () => {
  withEnv(
    { ...ALL_PAUSES_OFF, COMMS_EMAILS_PAUSED: "true" },
    () => {
      assertEquals(assertHotSheetEnqueueAllowed().paused, false);
      assertEquals(preSendBlockReason({ stream: "hot_sheet" }), null);
      assertEquals(preSendBlockReason({ stream: "transactional" }), null);
      assertEquals(preSendBlockReason({ stream: "communications" }), "stream_paused:communications");
    },
  );
});

Deno.test("missing preference row receives nothing (no fallback restored)", () => {
  assertEquals(evaluateCommsOptIn(null, "buyer_need").allowed, false);
  assertEquals(evaluateCommsOptIn(null, "buyer_need").reason, "missing_row");
});

Deno.test("explicit channel opt-in with no narrowing filters is a valid broad opt-in", () => {
  const row = {
    user_id: "a",
    buyer_need: true,
    client_needs_enabled: true,
    new_matches_enabled: true,
    // no min_price / max_price / property_types / geography anywhere
  };
  assertEquals(evaluateCommsOptIn(row, "buyer_need").allowed, true);
});

Deno.test("category off or either master switch off receives nothing", () => {
  const base = {
    user_id: "a",
    buyer_need: true,
    client_needs_enabled: true,
    new_matches_enabled: true,
  };
  assertEquals(evaluateCommsOptIn({ ...base, buyer_need: false }, "buyer_need").reason, "category_off");
  assertEquals(
    evaluateCommsOptIn({ ...base, client_needs_enabled: false }, "buyer_need").reason,
    "client_needs_disabled",
  );
  assertEquals(
    evaluateCommsOptIn({ ...base, new_matches_enabled: false }, "buyer_need").reason,
    "new_matches_disabled",
  );
});
