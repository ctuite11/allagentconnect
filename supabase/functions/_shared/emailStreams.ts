/**
 * Email queue stream classification + independent pause controls.
 *
 * Streams:
 *   hot_sheet       — Hot Sheet property / invite / comment notifications
 *   communications  — Communications Center broadcasts + digests
 *   transactional   — account, shares, messages, invites (not HS/Comms)
 *   system          — internal admin / security ops alerts
 *
 * Pause env vars:
 *   EMAIL_SENDING_PAUSED      — global; unset or not "false" ⇒ paused (fail closed)
 *   HOT_SHEET_EMAILS_PAUSED   — Hot Sheet stream only when "true"
 *   COMMS_EMAILS_PAUSED       — Communications stream only when "true"
 */

export type EmailStream =
  | "hot_sheet"
  | "communications"
  | "transactional"
  | "system";

export const EMAIL_STREAMS: readonly EmailStream[] = [
  "hot_sheet",
  "communications",
  "transactional",
  "system",
] as const;

/** Retired broad-audience listing pipeline — never claimable or sendable. */
export const RETIRED_BROAD_LISTING_TEMPLATE = "agent-new-listing-alert";
export const RETIRED_BROAD_LISTING_IDEM_PREFIX = "agent-new-listing:";

export const HOT_SHEET_TEMPLATES = new Set([
  "new-match-notification",
  "hot-sheet-status-change",
  "hot-sheet-subscriber-update",
  "hot-sheet-subscriber-status-change",
  "hot-sheet-alert",
  "hot-sheet-invite",
  "hot-sheet-comment",
  "hot-sheet-agent-reply",
  "hot-sheet-preview-blast",
  "hot-sheet-preview-blast-test",
]);

export const COMMS_TEMPLATES = new Set([
  "client-need-notification",
  "client-need-broadcast",
  "comms-digest",
  "buyer-alert",
  "seller-alert",
  "comms-center-guide",
  "reverse-prospecting",
]);

export const TRANSACTIONAL_TEMPLATES = new Set([
  "listing-share",
  "bulk-listing-share",
  "favorites-share",
  "new-message-notification",
  "client-agent-message",
  "buyer-workspace-invite",
  "account-delegate-invite",
  "agent-approval-accepted",
  "agent-approval-rejected",
  "agent-account-removed",
  "agent-client-email",
  "welcome-email",
  "showing-request",
  "listing-contact-inquiry",
  "price-change-notification",
  "stale-listing-reminder",
  "personal-forward-invite",
  "agent-invite",
  "agent-forward-invite",
  "team-approved",
  "team-rejected",
  "team-invite",
  "team-request-notification",
  "founder-invite-1to1",
  "license-verified",
  "agent-profile-contact",
  "agent-missing-opportunities",
  "bulk-email",
  "bulk-email-group",
  "new-listing-alert",
  "admin-created-invite",
]);

export const SYSTEM_TEMPLATES = new Set([
  "agent-verification-submitted",
]);

function envPaused(name: string): boolean {
  const raw = (Deno.env.get(name) ?? "").trim().toLowerCase();
  if (name === "EMAIL_SENDING_PAUSED") {
    return raw !== "false";
  }
  return raw === "true";
}

export function isGlobalEmailPaused(): boolean {
  return envPaused("EMAIL_SENDING_PAUSED");
}

export function isHotSheetEmailPaused(): boolean {
  return isGlobalEmailPaused() || envPaused("HOT_SHEET_EMAILS_PAUSED");
}

export function isCommsEmailPaused(): boolean {
  return isGlobalEmailPaused() || envPaused("COMMS_EMAILS_PAUSED");
}

export function isStreamPaused(stream: EmailStream): boolean {
  if (isGlobalEmailPaused()) return true;
  if (stream === "hot_sheet") return envPaused("HOT_SHEET_EMAILS_PAUSED");
  if (stream === "communications") return envPaused("COMMS_EMAILS_PAUSED");
  return false;
}

export function getClaimableStreams(): EmailStream[] {
  if (isGlobalEmailPaused()) return [];
  const out: EmailStream[] = ["transactional", "system"];
  if (!envPaused("HOT_SHEET_EMAILS_PAUSED")) out.push("hot_sheet");
  if (!envPaused("COMMS_EMAILS_PAUSED")) out.push("communications");
  return out;
}

export type PauseGateResult =
  | { paused: false }
  | { paused: true; reason: string; switch: string };

export function assertHotSheetEnqueueAllowed(): PauseGateResult {
  if (isGlobalEmailPaused()) {
    return {
      paused: true,
      reason: "Global email sending is paused",
      switch: "EMAIL_SENDING_PAUSED",
    };
  }
  if (envPaused("HOT_SHEET_EMAILS_PAUSED")) {
    return {
      paused: true,
      reason: "Hot Sheet emails are paused",
      switch: "HOT_SHEET_EMAILS_PAUSED",
    };
  }
  return { paused: false };
}

export function assertCommsEnqueueAllowed(): PauseGateResult {
  if (isGlobalEmailPaused()) {
    return {
      paused: true,
      reason: "Global email sending is paused",
      switch: "EMAIL_SENDING_PAUSED",
    };
  }
  if (envPaused("COMMS_EMAILS_PAUSED")) {
    return {
      paused: true,
      reason: "Communications Center emails are paused",
      switch: "COMMS_EMAILS_PAUSED",
    };
  }
  return { paused: false };
}

export function isRetiredBroadListingJob(job: {
  stream?: string | null;
  idempotency_key?: string | null;
  payload?: { template?: string; category?: string };
}): boolean {
  const template = String(job.payload?.template ?? "");
  const key = String(job.idempotency_key ?? "");
  return (
    template === RETIRED_BROAD_LISTING_TEMPLATE ||
    key.startsWith(RETIRED_BROAD_LISTING_IDEM_PREFIX)
  );
}

/**
 * Resolve expected stream from an explicit template allowlist.
 * Unknown templates return null (fail closed).
 * Retired broad-listing template is never a valid stream.
 */
export function inferStreamFromTemplate(
  template: string | null | undefined,
): EmailStream | null {
  if (!template) return null;
  if (template === RETIRED_BROAD_LISTING_TEMPLATE) return null;
  if (HOT_SHEET_TEMPLATES.has(template)) return "hot_sheet";
  if (COMMS_TEMPLATES.has(template)) return "communications";
  if (SYSTEM_TEMPLATES.has(template)) return "system";
  if (TRANSACTIONAL_TEMPLATES.has(template)) return "transactional";
  return null;
}

function asStream(value: string | null | undefined): EmailStream | null {
  const col = (value ?? "").trim();
  if (
    col === "hot_sheet" ||
    col === "communications" ||
    col === "transactional" ||
    col === "system"
  ) {
    return col;
  }
  return null;
}

/**
 * Fail-closed send gate:
 * 1. Retired broad-listing markers → blocked forever
 * 2. Template must be on an explicit allowlist
 * 3. Column stream (when set) must match template stream
 * 4. Stream must not be paused
 */
export function assertJobSendable(job: {
  stream?: string | null;
  idempotency_key?: string | null;
  payload?: { template?: string; category?: string };
}): { ok: true; stream: EmailStream } | { ok: false; error: string; reason?: string } {
  if (isRetiredBroadListingJob(job)) {
    return {
      ok: false,
      reason: "retired_broad_listing",
      error:
        "Retired broad listing pipeline job (agent-new-listing-alert / agent-new-listing:*) cannot be sent",
    };
  }

  const template = job.payload?.template ?? null;
  const expectedFromTemplate = inferStreamFromTemplate(template);
  if (!expectedFromTemplate) {
    return {
      ok: false,
      reason: "unknown_template",
      error: `Unknown or disallowed email template "${template ?? ""}"; refusing send`,
    };
  }

  const columnStream = asStream(job.stream ?? null);
  if (columnStream && columnStream !== expectedFromTemplate) {
    return {
      ok: false,
      reason: "stream_template_mismatch",
      error:
        `Stream/template mismatch: stream="${columnStream}" template="${template}" expected_stream="${expectedFromTemplate}"`,
    };
  }

  // Prefer column when present and matching; otherwise use template stream.
  const stream = columnStream ?? expectedFromTemplate;

  if (isStreamPaused(stream)) {
    return {
      ok: false,
      reason: "stream_paused",
      error: `Email stream "${stream}" is paused; refusing send`,
    };
  }

  return { ok: true, stream };
}

/** True when requeue should restore the claim attempt increment. */
export function isPauseRaceBlock(
  result: { ok: false; reason?: string },
): boolean {
  return result.reason === "stream_paused";
}

/**
 * Restore attempts after a pause-race requeue.
 * Claim increments attempts; pause requeue must not burn delivery budget.
 */
export function attemptsAfterPauseRaceRequeue(attempts: number | null | undefined): number {
  return Math.max(0, (attempts ?? 1) - 1);
}

/**
 * Mirrors email_jobs_claim eligibility (excluding FOR UPDATE locking).
 * Retired broad-listing jobs are never claimable regardless of stream.
 */
export function isJobClaimEligible(
  job: {
    status?: string | null;
    stream?: string | null;
    idempotency_key?: string | null;
    payload?: { template?: string };
  },
  allowedStreams: readonly EmailStream[],
): boolean {
  if ((job.status ?? "queued") !== "queued") return false;
  if (isRetiredBroadListingJob(job)) return false;
  const stream = asStream(job.stream ?? null);
  if (!stream) return false;
  return allowedStreams.includes(stream);
}

export function withStream<T extends Record<string, unknown>>(
  stream: EmailStream,
  row: T,
): T & { stream: EmailStream } {
  return { ...row, stream };
}

/** Active Hot Sheet idempotency prefixes (excludes retired agent-new-listing:). */
export const HOT_SHEET_IDEMPOTENCY_PREFIXES = [
  "hs-agent:",
  "hs:",
  "hss:",
  "hotsheet-",
  "hot_sheet_invite:",
  "hot_sheet_comment:",
  "hot_sheet_agent_reply:",
] as const;

export const COMMS_IDEMPOTENCY_PREFIXES = [
  "client-need:",
  "client-need-broadcast:",
  "comms-digest:",
  "comms:",
  "seller-alert:",
] as const;

export function isHotSheetIdempotencyKey(key: string): boolean {
  if (key.startsWith(RETIRED_BROAD_LISTING_IDEM_PREFIX)) return false;
  return HOT_SHEET_IDEMPOTENCY_PREFIXES.some((p) => key.startsWith(p));
}

export function isCommsIdempotencyKey(key: string): boolean {
  if (key.startsWith("comms:")) return true;
  return COMMS_IDEMPOTENCY_PREFIXES.some((p) => key.startsWith(p));
}

export function idempotencyKeyCollidesAcrossSystems(key: string): boolean {
  return isHotSheetIdempotencyKey(key) && isCommsIdempotencyKey(key);
}

/** Defense-in-depth for historical Hot-Sheet-synced client_needs rows. */
export function isHotSheetSyncedClientNeed(
  description: string | null | undefined,
): boolean {
  if (!description) return false;
  return description.startsWith("Auto-generated from hot sheet:");
}

/** SQL filter: retired broad pipeline (for claim exclusion / backlog reports). */
export const RETIRED_BROAD_LISTING_SQL_PREDICATE = `
(
  payload->>'template' = 'agent-new-listing-alert'
  OR idempotency_key LIKE 'agent-new-listing:%'
)
`.trim();
