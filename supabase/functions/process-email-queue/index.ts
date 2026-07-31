import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { EmailJob } from "../_shared/emailTypes.ts";
import { sendEmail } from "../_shared/sendEmail.ts";
import { UNSUPPORTED_TEMPLATE_ERROR_PREFIX } from "../_shared/renderEmailTemplate.ts";
import {
  assertJobSendable,
  attemptsAfterPauseRaceRequeue,
  isPauseRaceBlock,
} from "../_shared/emailStreams.ts";
import { assertEmailWorkerAuthority } from "../_shared/emailFunctionAuth.ts";
import {
  assertWorkerSendAllowed,
  EMAIL_CLAIM_MAX,
} from "../_shared/emailControlGate.ts";

// @auth-classification: internal-cron
// Also accepts admin JWT / service-role bearer. Anonymous and ordinary users are rejected.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-email-cron-secret",
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

  const auth = await assertEmailWorkerAuthority(req);
  if (!auth.ok) {
    return json({ error: auth.error }, { status: auth.status });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    console.error("[process-email-queue] Missing env vars");
    return json({ error: "config" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const workerRequestId = crypto.randomUUID();
  const claimedAt = new Date().toISOString();

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
    // Dual gate: EMAIL_SENDING_PAUSED=false AND database global_paused=false.
    const sendAllowed = await assertWorkerSendAllowed(supabase);
    if (sendAllowed.paused) {
      console.log(
        `[process-email-queue] paused — ${sendAllowed.switch}: ${sendAllowed.reason}`,
      );
      return json({
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        paused: true,
        switch: sendAllowed.switch,
        reason: sendAllowed.reason,
        claimable_streams: [],
      });
    }

    const claimableStreams = sendAllowed.claimableStreams;

    const { data: jobs, error: claimErr } = await supabase.rpc(
      "email_jobs_claim",
      { p_limit: EMAIL_CLAIM_MAX, p_allowed_streams: claimableStreams },
    );

    if (claimErr) throw claimErr;
    if (!jobs || jobs.length === 0) {
      return json({
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        claimable_streams: claimableStreams,
      });
    }

    console.log(
      `[process-email-queue] Claimed ${jobs.length} jobs from streams=[${claimableStreams.join(",")}]`,
    );

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

          // Fail-closed stream / pause gate immediately before send.
          // Re-check dual pause after claim to guarantee ZERO SENT on mid-run pause.
          const midRunPause = await assertWorkerSendAllowed(supabase);
          if (midRunPause.paused) {
            const runAfter = new Date(Date.now() + 15 * 60_000).toISOString();
            const restoredAttempts = attemptsAfterPauseRaceRequeue(job.attempts);
            await safeUpdateJob(
              job.id,
              {
                status: "queued",
                run_after: runAfter,
                last_error: midRunPause.reason,
                attempts: restoredAttempts,
              },
              { stage: "pause_after_claim_requeue" },
            );
            await logEvent(job.id, "pause_after_claim_requeue", {
              error: midRunPause.reason,
              switch: midRunPause.switch,
              attempts_restored_to: restoredAttempts,
              template,
              to,
              duration_ms: Date.now() - startedAt,
            });
            skipped++;
            return;
          }

          const sendGate = assertJobSendable(job as EmailJob & { stream?: string | null });
          if (!sendGate.ok) {
            if (isPauseRaceBlock(sendGate)) {
              // Paused after claim (rare race with env flip). Put back and
              // restore the claim attempt so pause races cannot exhaust
              // max_attempts.
              const runAfter = new Date(Date.now() + 15 * 60_000).toISOString();
              const restoredAttempts = attemptsAfterPauseRaceRequeue(job.attempts);
              await safeUpdateJob(
                job.id,
                {
                  status: "queued",
                  run_after: runAfter,
                  last_error: sendGate.error,
                  attempts: restoredAttempts,
                },
                { stage: "stream_paused_requeue" },
              );
              await logEvent(job.id, "stream_paused_requeue", {
                error: sendGate.error,
                reason: sendGate.reason,
                attempts_restored_to: restoredAttempts,
                template,
                to,
                duration_ms: Date.now() - startedAt,
              });
              skipped++;
            } else {
              // Terminal: retired / unknown template / stream mismatch → quarantine + trip.
              await safeUpdateJob(
                job.id,
                { status: "quarantined", last_error: sendGate.error },
                { stage: "stream_send_gate_quarantined" },
              );
              await logEvent(job.id, "quarantined", {
                error: sendGate.error,
                reason: sendGate.reason,
                template,
                to,
                duration_ms: Date.now() - startedAt,
              });
              await supabase.rpc("email_safety_evaluate_and_trip", {
                p_reason: sendGate.reason ?? "unknown_template",
                p_source_event_id: null,
                p_worker_error_rate: null,
                p_force_reason: null,
              });
              failed++;
            }
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
            const providerCallAt = new Date().toISOString();
            const { providerMessageId } = await sendEmail(job, RESEND_API_KEY);

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

            await supabase.rpc("email_delivery_ledger_append", {
              p_job_id: job.id,
              p_recipient_email: String(to),
              p_template: String(template),
              p_stream: sendGate.stream,
              p_source_event_id: null,
              p_worker_request_id: workerRequestId,
              p_claimed_at: claimedAt,
              p_provider_call_at: providerCallAt,
              p_provider_message_id: providerMessageId,
              p_result: "sent",
              p_failure_reason: null,
            });

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

            await supabase.rpc("email_delivery_ledger_append", {
              p_job_id: job.id,
              p_recipient_email: String(to ?? ""),
              p_template: String(template ?? ""),
              p_stream: sendGate.stream,
              p_source_event_id: null,
              p_worker_request_id: workerRequestId,
              p_claimed_at: claimedAt,
              p_provider_call_at: new Date().toISOString(),
              p_provider_message_id: null,
              p_result: "provider_error",
              p_failure_reason: msg,
            });

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

    const processed = jobs.length;
    const errorRate = processed > 0 ? failed / processed : 0;
    if (errorRate > 0.2) {
      await supabase.rpc("email_safety_evaluate_and_trip", {
        p_reason: null,
        p_source_event_id: null,
        p_worker_error_rate: errorRate,
        p_force_reason: null,
      });
    } else {
      await supabase.rpc("email_safety_evaluate_and_trip", {
        p_reason: null,
        p_source_event_id: null,
        p_worker_error_rate: null,
        p_force_reason: null,
      });
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
