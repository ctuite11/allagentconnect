import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { EmailJob } from "../_shared/emailTypes.ts";
import { sendEmail } from "../_shared/sendEmail.ts";
import {
  isGloballyPaused,
  kickAllowedStreams,
  preSendBlockReason,
} from "../_shared/emailStreams.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  /* ---- GLOBAL KILL SWITCH ----
   * Checked before the auth gate, before any email_jobs_claim call, and before any provider call.
   * Set the EMAIL_SENDING_PAUSED secret to "true" to freeze all outbound email. */
  if (isGloballyPaused()) {
    console.log("[kick-email-queue] EMAIL_SENDING_PAUSED=true — refusing to claim jobs");
    return json({ paused: true, processed: 0 });
  }

  // Any authenticated user JWT can reach this endpoint, so it may only claim
  // the streams on the kick allowlist. development_notifications is excluded
  // until this endpoint is made internal/service-role-only.
  const streams = kickAllowedStreams();
  if (streams.length === 0) {
    console.log("[kick-email-queue] no unpaused streams — refusing to claim jobs");
    return json({ paused: true, processed: 0 });
  }

  /* ---- Auth gate ---- */
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !userData?.user?.id) return json({ error: "Unauthorized" }, { status: 401 });

  /* ---- Env ---- */
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!RESEND_API_KEY || !SERVICE_KEY) {
    console.error("[kick-email-queue] Missing env vars");
    return json({ error: "config" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

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
    const { data: jobs, error: claimErr } = await supabase.rpc("email_jobs_claim", {
      p_limit: 5,
      p_streams: streams,
    });
    if (claimErr) throw claimErr;

    if (!jobs || jobs.length === 0) {
      return json({ processed: 0, sent: 0, failed: 0, retried: 0 });
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

        try {
          const blockReason = preSendBlockReason(job as never);
          if (blockReason) {
            await safeUpdateJob(
              job.id,
              { status: "queued", attempts: Math.max(0, (job.attempts ?? 1) - 1), last_error: `blocked:${blockReason}` },
              { stage: "pre_send_block" },
            );
            await logEvent(job.id, "blocked_before_send", { template, to, reason: blockReason });
            return;
          }

          await sendEmail(job, RESEND_API_KEY);

          await safeUpdateJob(job.id, { status: "sent" }, { stage: "mark_sent" });

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
