import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CLAIM_MAX,
  clampClaimLimit,
  dualGlobalPaused,
  envGlobalPaused,
  evaluateFanout,
  evaluateInvocationSize,
  frequencyAllows,
  GROUND_ZERO_AT_UTC,
  isPreGroundZero,
  shouldTripAutoShutdown,
} from "./emailGroundZeroPolicy.ts";
import { assertWorkerSendAllowed } from "./emailControlGate.ts";

Deno.test("Pre-Ground-Zero job: BLOCKED", () => {
  assertEquals(isPreGroundZero("2026-07-31T03:59:59.000Z"), true);
  assertEquals(isPreGroundZero("2026-07-31T04:00:00.000Z"), false);
  assertEquals(GROUND_ZERO_AT_UTC, "2026-07-31T04:00:00.000Z");
});

Deno.test("Database global pause: BLOCKED via dual gate", () => {
  const r = dualGlobalPaused("false", {
    global_paused: true,
    hot_sheet_paused: true,
    communications_paused: true,
    transactional_paused: true,
    system_paused: true,
  });
  assertEquals(r.paused, true);
  assertEquals(r.switch, "email_control_state.global_paused");
});

Deno.test("Missing environment pause setting: BLOCKED", () => {
  assertEquals(envGlobalPaused(undefined), true);
  assertEquals(envGlobalPaused(""), true);
  assertEquals(envGlobalPaused("true"), true);
  assertEquals(envGlobalPaused("false"), false);
});

Deno.test("Claim request greater than 5: CLAMPED TO 5", () => {
  assertEquals(clampClaimLimit(50), CLAIM_MAX);
  assertEquals(clampClaimLimit(5), 5);
  assertEquals(clampClaimLimit(0), 0);
  assertEquals(clampClaimLimit(-3), 0);
});

Deno.test("51-recipient unapproved event: ENTIRE EVENT QUARANTINED", () => {
  assertEquals(evaluateFanout(51, false), "quarantine_event");
  assertEquals(evaluateFanout(50, false), "ok");
  assertEquals(evaluateFanout(51, true), "ok");
});

Deno.test("101-job invocation: ABORTED", () => {
  assertEquals(evaluateInvocationSize(101), "abort");
  assertEquals(evaluateInvocationSize(100), "ok");
});

Deno.test("Fourth Hot Sheet email in 24 hours: SUPPRESSED", () => {
  assertEquals(
    frequencyAllows({
      stream: "hot_sheet",
      streamCount24h: 3,
      nonTransactionalCount24h: 3,
      transactionalCount24h: 0,
    }),
    false,
  );
});

Deno.test("Sixth non-transactional email in 24 hours: SUPPRESSED", () => {
  assertEquals(
    frequencyAllows({
      stream: "communications",
      streamCount24h: 2,
      nonTransactionalCount24h: 5,
      transactionalCount24h: 0,
    }),
    false,
  );
});

Deno.test("Automatic threshold trip: DATABASE GLOBAL PAUSE TRUE", () => {
  assertEquals(
    shouldTripAutoShutdown({
      providerCalls1m: 21,
      maxUnapprovedFanout: 0,
      maxRecipient1h: 0,
      workerErrorRate: null,
    }),
    "provider_calls_exceeded_20_per_minute",
  );
  assertEquals(
    shouldTripAutoShutdown({
      providerCalls1m: 0,
      maxUnapprovedFanout: 51,
      maxRecipient1h: 0,
      workerErrorRate: null,
    }),
    "unapproved_event_recipients_exceeded_50",
  );
  assertEquals(
    shouldTripAutoShutdown({
      providerCalls1m: 0,
      maxUnapprovedFanout: 0,
      maxRecipient1h: 6,
      workerErrorRate: null,
    }),
    "recipient_exceeded_5_emails_per_hour",
  );
  assertEquals(
    shouldTripAutoShutdown({
      providerCalls1m: 0,
      maxUnapprovedFanout: 0,
      maxRecipient1h: 0,
      workerErrorRate: 0.21,
    }),
    "worker_provider_error_rate_exceeded_20pct",
  );
});

Deno.test("Worker dual gate fails closed when control state missing", async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: { message: "missing" } }),
  };
  const prev = Deno.env.get("EMAIL_SENDING_PAUSED");
  Deno.env.set("EMAIL_SENDING_PAUSED", "false");
  try {
    const result = await assertWorkerSendAllowed(supabase);
    assertEquals(result.paused, true);
    if (result.paused) {
      assertEquals(result.switch, "email_control_state");
    }
  } finally {
    if (prev === undefined) Deno.env.delete("EMAIL_SENDING_PAUSED");
    else Deno.env.set("EMAIL_SENDING_PAUSED", prev);
  }
});

Deno.test("Worker dual gate requires EMAIL_SENDING_PAUSED=false even if DB unpaused", async () => {
  const supabase = {
    rpc: async () => ({
      data: {
        ground_zero_at: GROUND_ZERO_AT_UTC,
        global_paused: false,
        hot_sheet_paused: false,
        communications_paused: false,
        transactional_paused: false,
        system_paused: false,
      },
      error: null,
    }),
  };
  const prev = Deno.env.get("EMAIL_SENDING_PAUSED");
  Deno.env.delete("EMAIL_SENDING_PAUSED");
  try {
    const result = await assertWorkerSendAllowed(supabase);
    assertEquals(result.paused, true);
    if (result.paused) {
      assertEquals(result.switch, "EMAIL_SENDING_PAUSED");
    }
  } finally {
    if (prev === undefined) Deno.env.delete("EMAIL_SENDING_PAUSED");
    else Deno.env.set("EMAIL_SENDING_PAUSED", prev);
  }
});
