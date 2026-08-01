/**
 * Email stream isolation (production hotfix).
 *
 * Every queued email carries an immutable `stream` assigned by the database
 * from an explicit template allowlist. Workers must claim per-stream so a
 * single channel can be frozen without blocking the rest of the system.
 */
export type EmailStream =
  | "hot_sheet"
  | "communications"
  | "transactional"
  | "system";

export const ALL_STREAMS: EmailStream[] = [
  "hot_sheet",
  "communications",
  "transactional",
  "system",
];

/** Permanently retired listing-alert traffic. Never claim, never send. */
export function isPermanentlyBlockedJob(
  template: string | null | undefined,
  idempotencyKey: string | null | undefined,
): boolean {
  return (
    template === "agent-new-listing-alert" ||
    (idempotencyKey ?? "").startsWith("agent-new-listing:")
  );
}

function envTrue(name: string): boolean {
  return (Deno.env.get(name) ?? "").trim().toLowerCase() === "true";
}

export function isGloballyPaused(): boolean {
  return envTrue("EMAIL_SENDING_PAUSED");
}

export function isStreamPaused(stream: EmailStream | null | undefined): boolean {
  if (!stream) return true; // unclassified => fail closed
  if (stream === "hot_sheet") return envTrue("HOT_SHEET_EMAILS_PAUSED");
  if (stream === "communications") return envTrue("COMMS_EMAILS_PAUSED");
  return false;
}

/** Streams the worker is currently allowed to claim. */
export function allowedStreams(): EmailStream[] {
  if (isGloballyPaused()) return [];
  return ALL_STREAMS.filter((s) => !isStreamPaused(s));
}

/**
 * Last line of defence, re-evaluated immediately before any provider call.
 * Returns a reason string when the job must NOT be sent.
 */
export function preSendBlockReason(job: {
  stream?: string | null;
  idempotency_key?: string | null;
  payload?: { template?: string } | null;
}): string | null {
  const template = job.payload?.template ?? null;
  if (isPermanentlyBlockedJob(template, job.idempotency_key)) {
    return "permanently_retired_listing_alert";
  }
  const stream = (job.stream ?? null) as EmailStream | null;
  if (!stream || !ALL_STREAMS.includes(stream)) return "unclassified_stream";
  if (isGloballyPaused()) return "global_pause";
  if (isStreamPaused(stream)) return `stream_paused:${stream}`;
  return null;
}
