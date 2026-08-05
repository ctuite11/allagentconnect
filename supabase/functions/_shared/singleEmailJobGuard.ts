/**
 * Exact-job-ID delivery guard.
 *
 * The batch worker claims up to 50 rows across every unpaused stream, which
 * makes it unusable for "send exactly this one job". This module encodes the
 * allowlist + validation rules for the single-job path so the decision is
 * pure, unit-testable, and impossible to bypass from the request body.
 *
 * Fail closed everywhere: anything not explicitly allowed is rejected.
 */

export const SINGLE_SEND_ALLOWED_STREAM = "hot_sheet" as const;

export interface SingleSendAllowlistEntry {
  job_id: string;
  idempotency_key: string;
  recipient: string;
  template: string;
  stream: string;
}

/**
 * Only these exact jobs may ever be delivered through the single-job path.
 * Adding an entry is an explicit, reviewable act.
 */
export const SINGLE_SEND_ALLOWLIST: readonly SingleSendAllowlistEntry[] = [
  {
    job_id: "1d72f81a-b45a-439a-a919-deecc845a8cf",
    idempotency_key:
      "hs-agent:beb483e0-6125-40df-8532-15e53a3b4c59:0775b03d-e774-4dc9-9627-f0d2ec752fd3:active",
    recipient: "chris@allagentconnect.com",
    template: "new-match-notification",
    stream: SINGLE_SEND_ALLOWED_STREAM,
  },
];

/**
 * Exact-UUID gate, evaluated BEFORE a Supabase client is created or any query
 * runs. Any UUID other than an allowlisted job_id is rejected outright.
 */
export function findAllowlistEntryByJobId(
  jobId: string,
  allowlist: readonly SingleSendAllowlistEntry[] = SINGLE_SEND_ALLOWLIST,
): SingleSendAllowlistEntry | null {
  const id = jobId.trim().toLowerCase();
  return allowlist.find((e) => e.job_id.toLowerCase() === id) ?? null;
}

export function isAllowedJobId(
  jobId: string,
  allowlist: readonly SingleSendAllowlistEntry[] = SINGLE_SEND_ALLOWLIST,
): boolean {
  return findAllowlistEntryByJobId(jobId, allowlist) !== null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParseResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string };

/** Require an exact job_id. No batch mode, no fallback, no defaults. */
export function parseSingleJobRequest(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "job_id_required" };
  }
  const body = raw as Record<string, unknown>;

  // Reject any attempt to smuggle batch semantics in alongside job_id.
  for (const forbidden of ["limit", "p_limit", "streams", "p_streams", "job_ids"]) {
    if (forbidden in body) return { ok: false, error: "batch_mode_not_supported" };
  }

  const jobId = body.job_id;
  if (typeof jobId !== "string" || !UUID_RE.test(jobId.trim())) {
    return { ok: false, error: "job_id_required" };
  }
  return { ok: true, jobId: jobId.trim() };
}

export interface JobShape {
  id?: string | null;
  status?: string | null;
  stream?: string | null;
  idempotency_key?: string | null;
  payload?: { to?: unknown; template?: unknown } | null;
}

export type ValidationResult =
  | { ok: true; entry: SingleSendAllowlistEntry }
  | { ok: false; error: string };

function singleRecipient(to: unknown): string | null {
  if (typeof to === "string") {
    const parts = to.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length === 1 ? parts[0].toLowerCase() : null;
  }
  if (Array.isArray(to)) {
    const parts = to.filter((v): v is string => typeof v === "string" && !!v.trim());
    return parts.length === 1 ? parts[0].trim().toLowerCase() : null;
  }
  return null;
}

/**
 * Validate a row BEFORE any claim/update happens.
 * Every mismatch is a hard rejection — never a downgrade or a retry.
 */
export function validateJobForSingleSend(
  job: JobShape | null | undefined,
  allowlist: readonly SingleSendAllowlistEntry[] = SINGLE_SEND_ALLOWLIST,
): ValidationResult {
  if (!job) return { ok: false, error: "job_not_found" };
  if (typeof job.id !== "string" || !job.id.trim()) {
    return { ok: false, error: "job_id_missing" };
  }
  const entryById = findAllowlistEntryByJobId(job.id, allowlist);
  if (!entryById) return { ok: false, error: "job_id_not_allowlisted" };
  if (job.status !== "queued") return { ok: false, error: "job_not_queued" };
  if (job.stream !== SINGLE_SEND_ALLOWED_STREAM) {
    return { ok: false, error: "stream_not_allowed" };
  }

  const key = job.idempotency_key ?? "";
  const entry = allowlist.find((e) => e.idempotency_key === key);
  if (!entry) return { ok: false, error: "idempotency_key_not_allowlisted" };
  if (entry.job_id.toLowerCase() !== job.id.trim().toLowerCase()) {
    return { ok: false, error: "job_id_mismatch" };
  }

  if (job.stream !== entry.stream) return { ok: false, error: "stream_mismatch" };

  const template = job.payload?.template;
  if (template !== entry.template) return { ok: false, error: "template_mismatch" };

  const recipient = singleRecipient(job.payload?.to);
  if (!recipient || recipient !== entry.recipient.toLowerCase()) {
    return { ok: false, error: "recipient_mismatch" };
  }

  return { ok: true, entry };
}