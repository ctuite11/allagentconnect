import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { EmailJob } from "../_shared/emailTypes.ts";
import { sendEmail } from "../_shared/sendEmail.ts";
import { UNSUPPORTED_TEMPLATE_ERROR_PREFIX } from "../_shared/renderEmailTemplate.ts";
import {
  ACTIVATION_RETRY_WINDOW_MS,
  ACTIVATION_TEMPLATE,
  hydrateActivationEmail,
} from "../_shared/hydrateActivationEmail.ts";
import {
  allowedStreams,
  isGloballyPaused,
  preSendBlockReason,
} from "../_shared/emailStreams.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function toErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function computeBackoffSeconds(attemptsSoFar: number) {
  return Math.min(3600, 30 * Math.pow(2, Math.max(0, attemptsSoFar)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  /* ---- GLOBAL KILL SWITCH ----
   * Checked before any auth work, any email_jobs_claim call, and any provider call.
   * Set the EMAIL_SENDING_PAUSED secret to "true" to freeze all outbound email. */
  if (isGloballyPaused()) {
    console.log("[process-email-queue] EMAIL_SENDING_PAUSED=true — refusing to claim jobs");
    return json({ paused: true, processed: 0 });
  }

  const streams = allowedStreams();
  if (streams.length === 0) {
    console.log("[process-email-queue] no unpaused streams — refusing to claim jobs");
    return json({ paused: true, processed: 0 });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    console.error("[process-email-queue] Missing env vars");
    return json({ error: "config" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Best-effort event logger: never throws.
  const logEvent = async (
    jobId: string,
    event: string,
    detail: Record<string, unknown>,
  ) => {
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
      source: "worker",
    });

    if (error) {
      console.error(
        `[process-email-queue] email_events insert failed (job ${jobId}, ${event}):`,
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

  const safeUpdateJob = async (
    jobId: string,
    patch: Record<string, unknown>,
    context: Record<string, unknown>,
  ) => {
    const { error } = await supabase
      .from("email_jobs")
      .update(patch)
      .eq("id", jobId);

    if (error) {
      console.error(
        `[process-email-queue] email_jobs update failed (job ${jobId}):`,
        error,
      );

      await logEvent(jobId, "job_update_failed", {
        patch,
        update_error: error.message ?? error,
        ...context,
      });

      return false;
    }
    return true;
  };

  try {
    const { data: jobs, error: claimErr } = await supabase.rpc(
      "email_jobs_claim",
      { p_limit: 50, p_streams: streams },
    );

    if (claimErr) throw claimErr;
    if (!jobs || jobs.length === 0) {
      return json({ processed: 0, sent: 0, failed: 0, retried: 0 });
    }

    console.log(`[process-email-queue] Claimed ${jobs.length} jobs`);

    let sent = 0;
    let failed = 0;
    let retried = 0;
    let skipped = 0;
    // Respect Resend's 5 req/sec limit: process up to 5 concurrently per batch,
    // then wait until at least 1000ms has elapsed since the batch started.
    const CONCURRENCY = 5;
    const BATCH_WINDOW_MS = 1000;

    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const batchStartedAt = Date.now();
      const batch = (jobs as EmailJob[]).slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async (job) => {
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

            await safeUpdateJob(
              job.id,
              { status: "failed", last_error: msg },
              { stage: "payload_validation" },
            );

            await logEvent(job.id, "failed", {
              error: msg,
              template,
              to,
              attempts: job.attempts,
              max_attempts: job.max_attempts,
              duration_ms: Date.now() - startedAt,
            });

            failed++;
            return;
          }

          // Skip new-message notifications whose underlying message has
          // already been read by the recipient. The DB trigger enqueues
          // these with a 60-second delay specifically so an in-app read
          // suppresses the email.
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
                await safeUpdateJob(
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
                skipped++;
                return;
              }
            }
          }

          try {
            // Re-check every applicable pause control immediately before the
            // provider call. Fail closed: park the job back in the queue.
            const blockReason = preSendBlockReason(job as never);
            if (blockReason) {
              await safeUpdateJob(
                job.id,
                { status: "queued", attempts: Math.max(0, (job.attempts ?? 1) - 1), last_error: `blocked:${blockReason}` },
                { stage: "pre_send_block" },
              );
              await logEvent(job.id, "blocked_before_send", {
                template,
                to,
                reason: blockReason,
              });
              skipped++;
              return;
            }

            // Late rendering for activation emails: the plaintext token is
            // never persisted, so the worker re-derives it here. Deterministic
            // inputs => byte-identical body on every retry.
            const sendOptions: {
              providerIdempotencyKey?: string;
              htmlOverride?: string;
            } = {};

            if (template === ACTIVATION_TEMPLATE) {
              const createdAt = job.created_at ? Date.parse(job.created_at) : Date.now();
              if (Number.isFinite(createdAt) &&
                  Date.now() - createdAt > ACTIVATION_RETRY_WINDOW_MS) {
                // Past our retry ceiling (kept under Resend's 24h idempotency
                // retention). Never replay — a fresh token must be issued.
                await safeUpdateJob(
                  job.id,
                  { status: "failed", last_error: "activation retry window elapsed" },
                  { stage: "activation_retry_window" },
                );
                await logEvent(job.id, "failed", {
                  template,
                  to,
                  error: "activation retry window elapsed",
                });
                failed++;
                return;
              }

              const hydrated = await hydrateActivationEmail(
                supabase,
                (job.payload ?? {}) as Record<string, unknown>,
              );

              if (hydrated.outcome === "skip") {
                await safeUpdateJob(
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
                skipped++;
                return;
              }

              if (hydrated.outcome === "error") {
                throw new Error(`Activation hydration failed: ${hydrated.reason}`);
              }

              sendOptions.htmlOverride = hydrated.html;
              sendOptions.providerIdempotencyKey = hydrated.providerIdempotencyKey;
            }

            const { providerMessageId } = await sendEmail(job, RESEND_API_KEY, sendOptions);

            await safeUpdateJob(
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

            sent++;
          } catch (err) {
            const msg = toErrorMessage(err);

            const attemptsSoFar = job.attempts ?? 0;
            const nextAttempt = attemptsSoFar + 1;
            const maxAttempts = job.max_attempts ?? 1;

            console.error(
              `[process-email-queue] Job ${job.id} failed:`,
              msg,
            );

            // Fail-closed: unrenderable template = terminal failure. Never
            // retry (payload is broken, not transient) and never let a
            // subsequent attempt fall through to a placeholder body.
            const isUnsupportedTemplate = msg.startsWith(
              UNSUPPORTED_TEMPLATE_ERROR_PREFIX,
            );

            if (!isUnsupportedTemplate && nextAttempt < maxAttempts) {
              const backoffSec = computeBackoffSeconds(attemptsSoFar);
              const runAfter = new Date(
                Date.now() + backoffSec * 1000,
              ).toISOString();

              await safeUpdateJob(
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

              retried++;
            } else {
              await safeUpdateJob(
                job.id,
                { status: "failed", last_error: msg },
                {
                  stage: isUnsupportedTemplate
                    ? "unsupported_template"
                    : "terminal_fail",
                },
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

              failed++;
            }
          }
        }),
      );

      // Throttle: ensure at most 5 sends per second across batches.
      if (i + CONCURRENCY < jobs.length) {
        const elapsed = Date.now() - batchStartedAt;
        const wait = Math.max(0, BATCH_WINDOW_MS - elapsed);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    }

    console.log(
      `[process-email-queue] Done: ${sent} sent, ${failed} failed, ${retried} retried, ${skipped} skipped`,
    );

    return json({ processed: jobs.length, sent, failed, retried, skipped });
  } catch (err) {
    console.error("[process-email-queue] Error:", err);
    return json({ error: toErrorMessage(err) }, { status: 500 });
  }
});
