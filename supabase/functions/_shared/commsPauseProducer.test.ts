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

function withEnv(vals: Record<string, string>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vals)) {
    prev[k] = Deno.env.get(k);
    Deno.env.set(k, v);
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

Deno.test("comms pause blocks the producer via COMMS_EMAILS_PAUSED", () => {
  withEnv({ EMAIL_SENDING_PAUSED: "false", COMMS_EMAILS_PAUSED: "true" }, () => {
    const gate = assertCommsEnqueueAllowed();
    assertEquals(gate.paused, true);
    assertEquals(gate.paused && gate.switch, "COMMS_EMAILS_PAUSED");
  });
});

Deno.test("comms pause blocks the producer via the global switch", () => {
  withEnv({ EMAIL_SENDING_PAUSED: "true", COMMS_EMAILS_PAUSED: "false" }, () => {
    const gate = assertCommsEnqueueAllowed();
    assertEquals(gate.paused, true);
    assertEquals(gate.paused && gate.switch, "EMAIL_SENDING_PAUSED");
  });
});

Deno.test("producer proceeds only when both switches are off", () => {
  withEnv({ EMAIL_SENDING_PAUSED: "false", COMMS_EMAILS_PAUSED: "false" }, () => {
    assertEquals(assertCommsEnqueueAllowed().paused, false);
  });
});

Deno.test("comms pause leaves Hot Sheet and transactional streams untouched", () => {
  withEnv(
    {
      EMAIL_SENDING_PAUSED: "false",
      COMMS_EMAILS_PAUSED: "true",
      HOT_SHEET_EMAILS_PAUSED: "false",
    },
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
