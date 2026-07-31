/**
 * Pure Ground Zero policy helpers mirrored for Deno unit tests.
 * SQL remains source of truth for claim/enqueue; these mirror the rules.
 */

export const GROUND_ZERO_AT_UTC = "2026-07-31T04:00:00.000Z";
export const CLAIM_MAX = 5;
export const UNAPPROVED_FANOUT_MAX = 50;
export const INVOCATION_JOB_MAX = 100;

export type PauseState = {
  global_paused: boolean;
  hot_sheet_paused: boolean;
  communications_paused: boolean;
  transactional_paused: boolean;
  system_paused: boolean;
};

export function clampClaimLimit(requested: number): number {
  return Math.min(CLAIM_MAX, Math.max(0, Math.floor(requested)));
}

export function isPreGroundZero(
  createdAtIso: string,
  groundZeroAtIso = GROUND_ZERO_AT_UTC,
): boolean {
  return new Date(createdAtIso).getTime() < new Date(groundZeroAtIso).getTime();
}

export function envGlobalPaused(raw: string | undefined): boolean {
  return (raw ?? "").trim().toLowerCase() !== "false";
}

export function dualGlobalPaused(
  envRaw: string | undefined,
  db: PauseState | null,
): { paused: boolean; switch: string } {
  if (envGlobalPaused(envRaw)) {
    return { paused: true, switch: "EMAIL_SENDING_PAUSED" };
  }
  if (!db) {
    return { paused: true, switch: "email_control_state" };
  }
  if (db.global_paused) {
    return { paused: true, switch: "email_control_state.global_paused" };
  }
  return { paused: false, switch: "" };
}

export function evaluateFanout(
  recipientCount: number,
  approved: boolean,
): "ok" | "quarantine_event" {
  if (!approved && recipientCount > UNAPPROVED_FANOUT_MAX) return "quarantine_event";
  return "ok";
}

export function evaluateInvocationSize(
  jobCount: number,
): "ok" | "abort" {
  if (jobCount > INVOCATION_JOB_MAX) return "abort";
  return "ok";
}

export function frequencyAllows(args: {
  stream: "hot_sheet" | "communications" | "transactional" | "system";
  streamCount24h: number;
  nonTransactionalCount24h: number;
  transactionalCount24h: number;
}): boolean {
  if (args.stream === "hot_sheet" || args.stream === "communications") {
    if (args.streamCount24h >= 3) return false;
    if (args.nonTransactionalCount24h >= 5) return false;
    return true;
  }
  return args.transactionalCount24h < 10;
}

export function shouldTripAutoShutdown(args: {
  providerCalls1m: number;
  maxUnapprovedFanout: number;
  maxRecipient1h: number;
  workerErrorRate: number | null;
  forcedReason?: string | null;
}): string | null {
  if (args.forcedReason) return args.forcedReason;
  if (args.providerCalls1m > 20) return "provider_calls_exceeded_20_per_minute";
  if (args.maxUnapprovedFanout > 50) {
    return "unapproved_event_recipients_exceeded_50";
  }
  if (args.maxRecipient1h > 5) return "recipient_exceeded_5_emails_per_hour";
  if (args.workerErrorRate != null && args.workerErrorRate > 0.2) {
    return "worker_provider_error_rate_exceeded_20pct";
  }
  return null;
}
