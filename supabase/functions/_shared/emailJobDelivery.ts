/**
 * Single-job email delivery core.
 *
 * This is the ONE implementation of "take a claimed email_jobs row and try to
 * deliver it": rendering / late-hydration, the pre-send pause recheck, the
 * provider call, event logging, retry backoff and the sent/failed row update.
 *
 * Both callers use it:
 *   - process-email-queue      → batch claim, then deliver each claimed row
 *   - send-single-email-job    → claim exactly one row, then deliver it
 *
 * There must never be a second copy of this logic.
 */
import type { EmailJob } from "./emailTypes.ts";
import { sendEmail } from "./sendEmail.ts";
import { UNSUPPORTED_TEMPLATE_ERROR_PREFIX } from "./renderEmailTemplate.ts";
import {
  ACTIVATION_RETRY_WINDOW_MS,
  hydrateActivationEmail,
} from "./hydrateActivationEmail.ts";
import { isActivationTemplate } from "./hydrateActivationEmail.ts";
import {
  LOGIN_LINK_RETRY_WINDOW_MS,
  LOGIN_LINK_TEMPLATE,
  hydrateLoginLinkEmail,
} from "./hydrateLoginLinkEmail.ts";
import { preSendBlockReason } from "./emailStreams.ts";

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export type LogEventFn = (
  jobId: string,
  event: string,
  detail: Record<string, unknown>,
) => Promise<void>;

export type UpdateJobFn = (
  jobId: string,
  patch: Record<string, unknown>,
  context: Record<string, unknown>,
) => Promise<boolean>;

export type DeliveryOutcome = "sent" | "failed" | "retried" | "skipped";

export interface DeliveryResult {
  outcome: DeliveryOutcome;
  providerMessageId?: string | null;
  reason?: string;
  error?: string;
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function computeBackoffSeconds(attemptsSoFar: number): number {
  return Math.min(3600, 30 * Math.pow(2, Math.max(0, attemptsSoFar)));
}

/** Best-effort event logger: never throws. */
export function makeLogEvent(
  supabase: SupabaseLike,
  logPrefix: string,
  source = "worker",
): LogEventFn {
  return async (jobId, event, detail) => {
    const providerMessageId =
      typeof detail.provider_message_id === "string"
        ? (detail.provider_message_id as string)
        : null;
    const recipient =
      typeof detail.to === "string"
        ? (detail.to as string)
        : Array.isArray(detail.to)
          ? (detail.to as unknown[]).filter((x) => typeof x === "string").join(",")
          : null;

    const { error } = await supabase.from("email_events").insert({
      job_id: jobId,
      event,
      detail,
      provider_message_id: providerMessageId,
      recipient_email: recipient,
      provider_event_at: new Date().toISOString(),
      source,
    });

    if (error) {
      console.error(
        `${logPrefix} email_events insert failed (job ${jobId}, ${event}):`,
        error,
      );
      try {
        await supabase.from("email_events").insert({
          job_id: jobId,
          event: "event_insert_failed",
          detail: {
            original_event: event,
            insert_error: error.message ?? error,
            original_detail: detail,
          },
        });
      } catch {
        // swallow — console is the last resort
      }
    }
  };
}

export function makeSafeUpdateJob(
  supabase: SupabaseLike,
  logEvent: LogEventFn,
  logPrefix: string,
): UpdateJobFn {
  return async (jobId, patch, context) => {
    const { error } = await supabase
      .from("email_jobs")
      .update(patch)
      .eq("id", jobId);

    if (error) {
      console.error(`${logPrefix} email_jobs update failed (job ${jobId}):`, error);
      await logEvent(jobId, "job_update_failed", {
        patch,
        update_error: error.message ?? error,
        ...context,
      });
      return false;
    }
    return true;
  };
}

/**
 * Deliver one already-claimed job. Callers own claiming and counters.
 */
export async function deliverEmailJob(opts: {
  job: EmailJob;
  supabase: SupabaseLike;
  resendApiKey: string;
  logEvent: LogEventFn;
  updateJob: UpdateJobFn;
  logPrefix?: string;
}): Promise<DeliveryResult> {
  const { job, supabase, resendApiKey, logEvent, updateJob } = opts;
  const logPrefix = opts.logPrefix ?? "[email-delivery]";
  const startedAt = Date.now();

  const template = job.payload?.template;
  const to = job.payload?.to;

  await logEvent(job.id, "processing_started", {
    template,
    to,
    attempts: job.attempts,
    max_attempts: job.max_attempts,
  });

  // Payload sanity check
  if (!template || !to) {
    const msg = `Invalid email payload: missing ${!to ? "to" : ""}${
      !to && !template ? " and " : ""
    }${!template ? "template" : ""}`;

    await updateJob(job.id, { status: "failed", last_error: msg }, {
      stage: "payload_validation",
    });
    await logEvent(job.id, "failed", {
      error: msg,
      template,
      to,
      attempts: job.attempts,
      max_attempts: job.max_attempts,
      duration_ms: Date.now() - startedAt,
    });
    return { outcome: "failed", error: msg };
  }

  // Skip new-message notifications whose underlying message has already been
  // read by the recipient. The DB trigger enqueues these with a 60-second
  // delay specifically so an in-app read suppresses the email.
  if (template === "new-message-notification") {
    const messageId =
      (job.payload?.variables as { message_id?: string } | undefined)?.message_id;
    if (messageId) {
      const { data: msgRow } = await supabase
        .from("conversation_messages")
        .select("read_at")
        .eq("id", messageId)
        .maybeSingle();
      if (msgRow?.read_at) {
        await updateJob(
          job.id,
          {
            status: "sent",
            provider_message_id: "skipped:read",
            delivery_status: "skipped_read",
            delivery_status_at: new Date().toISOString(),
          },
          { stage: "skip_already_read" },
        );
        await logEvent(job.id, "skipped_already_read", {
          template,
          to,
          message_id: messageId,
          duration_ms: Date.now() - startedAt,
        });
        return { outcome: "skipped", reason: "already_read" };
      }
    }
  }

  try {
    // Re-check every applicable pause control immediately before the provider
    // call. Fail closed: park the job back in the queue.
    const blockReason = preSendBlockReason(job as never);
    if (blockReason) {
      await updateJob(
        job.id,
        {
          status: "queued",
          attempts: Math.max(0, (job.attempts ?? 1) - 1),
          last_error: `blocked:${blockReason}`,
        },
        { stage: "pre_send_block" },
      );
      await logEvent(job.id, "blocked_before_send", {
        template,
        to,
        reason: blockReason,
      });
      return { outcome: "skipped", reason: blockReason };
    }

    // Late rendering for activation emails: the plaintext token is never
    // persisted, so the worker re-derives it here. Deterministic inputs =>
    // byte-identical body on every retry.
    const sendOptions: {
      providerIdempotencyKey?: string;
      htmlOverride?: string;
    } = {};

    const hasActivationToken =
      typeof (job.payload as Record<string, unknown> | null)?.activation_token_id === "string";

    if (isActivationTemplate(template) && hasActivationToken) {
      const createdAt = job.created_at ? Date.parse(job.created_at) : Date.now();
      if (
        Number.isFinite(createdAt) &&
        Date.now() - createdAt > ACTIVATION_RETRY_WINDOW_MS
      ) {
        // Past our retry ceiling (kept under Resend's 24h idempotency
        // retention). Never replay — a fresh token must be issued.
        await updateJob(
          job.id,
          { status: "failed", last_error: "activation retry window elapsed" },
          { stage: "activation_retry_window" },
        );
        await logEvent(job.id, "failed", {
          template,
          to,
          error: "activation retry window elapsed",
        });
        return { outcome: "failed", error: "activation retry window elapsed" };
      }

      const hydrated = await hydrateActivationEmail(
        supabase,
        (job.payload ?? {}) as Record<string, unknown>,
      );

      if (hydrated.outcome === "skip") {
        await updateJob(
          job.id,
          {
            status: "sent",
            provider_message_id: "skipped:activation",
            delivery_status: "skipped_activation",
            delivery_status_at: new Date().toISOString(),
            last_error: hydrated.reason,
          },
          { stage: "skip_activation" },
        );
        await logEvent(job.id, "skipped_activation", {
          template,
          to,
          reason: hydrated.reason,
        });
        return { outcome: "skipped", reason: hydrated.reason };
      }

      if (hydrated.outcome === "error") {
        throw new Error(`Activation hydration failed: ${hydrated.reason}`);
      }

      sendOptions.htmlOverride = hydrated.html;
      sendOptions.providerIdempotencyKey = hydrated.providerIdempotencyKey;
    }

    // Same late-rendering contract for AAC sign-in links.
    if (template === LOGIN_LINK_TEMPLATE) {
      const createdAt = job.created_at ? Date.parse(job.created_at) : Date.now();
      if (
        Number.isFinite(createdAt) &&
        Date.now() - createdAt > LOGIN_LINK_RETRY_WINDOW_MS
      ) {
        await updateJob(
          job.id,
          { status: "failed", last_error: "login link retry window elapsed" },
          { stage: "login_link_retry_window" },
        );
        await logEvent(job.id, "failed", {
          template,
          to,
          error: "login link retry window elapsed",
        });
        return { outcome: "failed", error: "login link retry window elapsed" };
      }

      const hydrated = await hydrateLoginLinkEmail(
        supabase,
        (job.payload ?? {}) as Record<string, unknown>,
      );

      if (hydrated.outcome === "skip") {
        await updateJob(
          job.id,
          {
            status: "sent",
            provider_message_id: "skipped:login-link",
            delivery_status: "skipped_login_link",
            delivery_status_at: new Date().toISOString(),
            last_error: hydrated.reason,
          },
          { stage: "skip_login_link" },
        );
        await logEvent(job.id, "skipped_login_link", {
          template,
          to,
          reason: hydrated.reason,
        });
        return { outcome: "skipped", reason: hydrated.reason };
      }

      if (hydrated.outcome === "error") {
        throw new Error(`Login link hydration failed: ${hydrated.reason}`);
      }

      sendOptions.htmlOverride = hydrated.html;
      sendOptions.providerIdempotencyKey = hydrated.providerIdempotencyKey;
    }

    const { providerMessageId } = await sendEmail(job, resendApiKey, sendOptions);

    await updateJob(
      job.id,
      {
        status: "sent",
        provider_message_id: providerMessageId,
        delivery_status: "sent",
        delivery_status_at: new Date().toISOString(),
      },
      { stage: "mark_sent" },
    );

    await logEvent(job.id, "sent", {
      template,
      to,
      provider_message_id: providerMessageId,
      duration_ms: Date.now() - startedAt,
    });

    return { outcome: "sent", providerMessageId };
  } catch (err) {
    const msg = toErrorMessage(err);

    const attemptsSoFar = job.attempts ?? 0;
    const nextAttempt = attemptsSoFar + 1;
    const maxAttempts = job.max_attempts ?? 1;

    console.error(`${logPrefix} Job ${job.id} failed:`, msg);

    // Fail-closed: unrenderable template = terminal failure. Never retry
    // (payload is broken, not transient) and never let a subsequent attempt
    // fall through to a placeholder body.
    const isUnsupportedTemplate = msg.startsWith(UNSUPPORTED_TEMPLATE_ERROR_PREFIX);

    if (!isUnsupportedTemplate && nextAttempt < maxAttempts) {
      const backoffSec = computeBackoffSeconds(attemptsSoFar);
      const runAfter = new Date(Date.now() + backoffSec * 1000).toISOString();

      await updateJob(
        job.id,
        { status: "queued", run_after: runAfter, last_error: msg },
        { stage: "schedule_retry" },
      );

      await logEvent(job.id, "retry_scheduled", {
        error: msg,
        template,
        to,
        attempts: attemptsSoFar,
        next_attempt: nextAttempt,
        max_attempts: maxAttempts,
        backoff_seconds: backoffSec,
        run_after: runAfter,
        duration_ms: Date.now() - startedAt,
      });

      return { outcome: "retried", error: msg };
    }

    await updateJob(
      job.id,
      { status: "failed", last_error: msg },
      { stage: isUnsupportedTemplate ? "unsupported_template" : "terminal_fail" },
    );

    await logEvent(job.id, "failed", {
      error: msg,
      template,
      to,
      attempts: attemptsSoFar,
      next_attempt: nextAttempt,
      max_attempts: maxAttempts,
      duration_ms: Date.now() - startedAt,
      unsupported_template: isUnsupportedTemplate || undefined,
    });

    return { outcome: "failed", error: msg };
  }
}