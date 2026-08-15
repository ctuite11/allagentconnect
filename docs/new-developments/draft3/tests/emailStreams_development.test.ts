// DRAFT 3 — not deployed. On apply, move to
// supabase/functions/_shared/emailStreams_development.test.ts
// NOTE: tests import ../diffs/emailStreams.ts.proposed.ts (a .ts copy of the proposed
// file) so Draft 3 type-checks standalone; on apply the import becomes
// ../../../../supabase/functions/_shared/emailStreams.ts and this copy is deleted.
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ALL_STREAMS,
  allowedStreams,
  kickAllowedStreams,
  preSendBlockReason,
} from "../diffs/emailStreams.ts.proposed.ts";

Deno.test("development_notifications is a registered stream", () => {
  assert(ALL_STREAMS.includes("development_notifications" as never));
});

Deno.test("worker may claim development_notifications when unpaused", () => {
  Deno.env.delete("EMAIL_SENDING_PAUSED");
  Deno.env.delete("DEVELOPMENT_EMAILS_PAUSED");
  assert(allowedStreams().includes("development_notifications" as never));
});

Deno.test("kick-email-queue may NOT claim development_notifications", () => {
  Deno.env.delete("EMAIL_SENDING_PAUSED");
  Deno.env.delete("DEVELOPMENT_EMAILS_PAUSED");
  assertFalse(kickAllowedStreams().includes("development_notifications" as never));
  // other streams are unaffected
  assert(kickAllowedStreams().includes("transactional" as never));
});

Deno.test("DEVELOPMENT_EMAILS_PAUSED freezes only this stream", () => {
  Deno.env.set("DEVELOPMENT_EMAILS_PAUSED", "true");
  assertFalse(allowedStreams().includes("development_notifications" as never));
  assert(allowedStreams().includes("transactional" as never));
  Deno.env.delete("DEVELOPMENT_EMAILS_PAUSED");
});

Deno.test("pre-send gate blocks paused / unclassified development jobs", () => {
  const job = {
    stream: "development_notifications",
    idempotency_key: "dev-lead:abc:contact:def",
    payload: { template: "development-lead-notification" },
  };
  Deno.env.delete("EMAIL_SENDING_PAUSED");
  Deno.env.delete("DEVELOPMENT_EMAILS_PAUSED");
  assertEquals(preSendBlockReason(job), null);

  Deno.env.set("DEVELOPMENT_EMAILS_PAUSED", "true");
  assertEquals(preSendBlockReason(job), "stream_paused:development_notifications");
  Deno.env.delete("DEVELOPMENT_EMAILS_PAUSED");

  Deno.env.set("EMAIL_SENDING_PAUSED", "true");
  assertEquals(preSendBlockReason(job), "global_pause");
  Deno.env.delete("EMAIL_SENDING_PAUSED");

  assertEquals(preSendBlockReason({ ...job, stream: null }), "unclassified_stream");
});
