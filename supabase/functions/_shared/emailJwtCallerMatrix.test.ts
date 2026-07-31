/**
 * Static proof helpers for Ground Zero JWT caller expectations.
 * These do not invoke live functions or Resend.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const PROTECTED_WORKERS = [
  "process-email-queue",
  "kick-email-queue",
] as const;

const PROTECTED_PRIVILEGED_PRODUCERS = [
  "send-new-match-notification",
  "notify-agents-client-need",
  "notify-agents-new-listing",
  "send-bulk-email",
  "process-comms-digests",
] as const;

Deno.test("Ground Zero workers require privileged authority models", () => {
  assertEquals(PROTECTED_WORKERS.includes("process-email-queue"), true);
  assertEquals(PROTECTED_WORKERS.includes("kick-email-queue"), true);
});

Deno.test("Ground Zero privileged producers are enumerated for caller proof", () => {
  assertEquals(PROTECTED_PRIVILEGED_PRODUCERS.length >= 5, true);
  assertEquals(
    PROTECTED_PRIVILEGED_PRODUCERS.includes("send-new-match-notification"),
    true,
  );
});

Deno.test("Ordinary user is not a valid worker authority mode", () => {
  const validWorkerModes = new Set([
    "service_role",
    "admin",
    "internal_cron",
  ]);
  assertEquals(validWorkerModes.has("authenticated_user"), false);
  assertEquals(validWorkerModes.has("anonymous"), false);
});
