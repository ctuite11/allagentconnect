import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { EmailJob } from "../_shared/emailTypes.ts";
import { sendEmail } from "../_shared/sendEmail.ts";
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

// @auth-classification: admin-jwt
// Also accepts service-role bearer / EMAIL_CRON_SECRET for internal workers.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-email-cron-secret",
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
  // Same formula as before: min(3600, 30 * 2^attempts)
  return Math.min(3600, 30 * Math.pow(2, Math.max(0, attemptsSoFar)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const auth = await assertEmailWorkerAuthority(req);
  if (!auth.ok) {
    return json({ error: auth.error }, { status: auth.status });
  }

  /* ---- Env ---- */
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!RESEND_API_KEY || !SERVICE_KEY) {
    console.error("[kick-email-queue] Missing env vars");
    return json({ error: "config" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const workerRequestId = crypto.randomUUID();
  const claimedAt = new Date().toISOString();

  // Best-effort event logger: never throws; logs failures and records a meta-event when possible.
  const logEvent = async (
    jobId: string,
    event: string,
    detail: Record<string, unknown>,
  ) => {
    const { error } = await supabase.from("email_events").insert({
      job_id: jobId,
      event,
      detail,
    });

    if (error) {
      console.error(
        `[kick-email-queue] email_events insert failed (job ${jobId}, ${event}):`,
        error,
      );

      // Secondary meta-event (best-effort). If this also fails, console is still a source of truth.
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
        // swallow
      }
    }
  };

  const safeUpdateJob = async (
    jobId: string,
    patch: Record<string, unknown>,
    context: Record<string, unknown>,
  ) => {
    const { error } = await supabase.from("email_jobs").update(patch).eq("id", jobId);

    if (error) {
      console.error(`[kick-email-queue] email_jobs update failed (job ${jobId}):`, error);

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
    const sendAllowed = await assertWorkerSendAllowed(supabase);
    if (sendAllowed.paused) {
      return json({
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        paused: true,
        switch: sendAllowed.switch,
        reason: sendAllowed.reason,
      });
    }
    const claimableStreams = sendAllowed.claimableStreams;

    const { data: jobs, error: claimErr } = await supabase.rpc("email_jobs_claim", {
      p_limit: EMAIL_CLAIM_MAX,
      p_allowed_streams: claimableStreams,
    });
    if (claimErr) throw claimErr;

    if (!jobs || jobs.length === 0) {
      return json({ processed: 0, sent: 0, failed: 0, retried: 0, claimable_streams: claimableStreams });
    }

    console.log(`[kick-email-queue] Claimed ${jobs.length} jobs`);

    let sent = 0;
    let failed = 0;
    let retried = 0;

    await Promise.all(
      (jobs as EmailJob[]).map(async (job) => {
        const startedAt = Date.now();

        const template = job.payload?.template;
        const to = job.payload?.to;

        await logEvent(job.id, "processing_started", {
          template,
          to,
          attempts: job.attempts,
          max_attempts: job.max_attempts,
        });

        // Payload sanity check (prevents ambiguous sendEmail failures)
        if (!template || !to) {
          const msg =
            `Invalid email payload: missing ${!to ? "to" : ""}${
              !to && !template ? " and " : ""
            }${!template ? "template" : ""}`;

          await safeUpdateJob(job.id, { status: "failed", last_error: msg }, { stage: "payload_validation" });

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
          return;
        }

        const sendGate = assertJobSendable(job);
        if (!sendGate.ok) {
          if (isPauseRaceBlock(sendGate)) {
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
            return;
          }
          await safeUpdateJob(
            job.id,
            { status: "quarantined", last_error: sendGate.error },
            { stage: "stream_send_gate_quarantined" },
          );
          await supabase.rpc("email_safety_evaluate_and_trip", {
            p_reason: sendGate.reason ?? "unknown_template",
            p_source_event_id: null,
            p_worker_error_rate: null,
            p_force_reason: null,
          });
          failed++;
          return;
        }

        try {
          const providerCallAt = new Date().toISOString();
          const { providerMessageId } = await sendEmail(job, RESEND_API_KEY);

          await safeUpdateJob(job.id, { status: "sent" }, { stage: "mark_sent" });

          await supabase.rpc("email_delivery_ledger_append", {
            p_job_id: job.id,
            p_recipient_email: String(to),
            p_template: String(template),
            p_stream: sendGate.stream,
            p_source_event_id: null,
            p_worker_request_id: workerRequestId,
            p_claimed_at: claimedAt,
            p_provider_call_at: providerCallAt,
            p_provider_message_id: providerMessageId ?? null,
            p_result: "sent",
            p_failure_reason: null,
          });

          await logEvent(job.id, "sent", {
            template,
            to,
            duration_ms: Date.now() - startedAt,
          });

          sent++;
        } catch (err) {
          const msg = toErrorMessage(err);

          const attemptsSoFar = job.attempts ?? 0; // attempts already consumed prior to this run
          const nextAttempt = attemptsSoFar + 1;
          const maxAttempts = job.max_attempts ?? 1;

          console.error(`[kick-email-queue] Job ${job.id} failed:`, msg);

          // Retry if we still have remaining attempts AFTER this failure.
          if (nextAttempt < maxAttempts) {
            const backoffSec = computeBackoffSeconds(attemptsSoFar);
            const runAfter = new Date(Date.now() + backoffSec * 1000).toISOString();

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
              { stage: "terminal_fail" },
            );

            await logEvent(job.id, "failed", {
              error: msg,
              template,
              to,
              attempts: attemptsSoFar,
              next_attempt: nextAttempt,
              max_attempts: maxAttempts,
              duration_ms: Date.now() - startedAt,
            });

            failed++;
          }
        }
      }),
    );

    console.log(`[kick-email-queue] Done: ${sent} sent, ${failed} failed, ${retried} retried`);

    return json({ processed: jobs.length, sent, failed, retried });
  } catch (err) {
    console.error("[kick-email-queue] Error:", err);
    return json({ error: toErrorMessage(err) }, { status: 500 });
  }
});
