import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { EmailJob } from "../_shared/emailTypes.ts";
import {
  allowedStreams,
  isGloballyPaused,
} from "../_shared/emailStreams.ts";
import {
  deliverEmailJob,
  makeLogEvent,
  makeSafeUpdateJob,
  toErrorMessage,
} from "../_shared/emailJobDelivery.ts";
import { authorizeInternalServiceRole } from "../_shared/internalServiceRoleAuth.ts";

const LOG_PREFIX = "[process-email-queue]";

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

  /* ---- INTERNAL-ONLY AUTHORIZATION ----
   * Runs immediately after the global pause gate and BEFORE allowedStreams(),
   * Supabase client creation, email_jobs_claim, or any provider access.
   * Only the exact service-role key is accepted: anon keys, authenticated user
   * JWTs, missing and malformed bearers all get 401 with zero claims. */
  const auth = authorizeInternalServiceRole(req);
  if (!auth.ok) {
    return json({ error: auth.error }, { status: auth.status });
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

  const logEvent = makeLogEvent(supabase, LOG_PREFIX);
  const safeUpdateJob = makeSafeUpdateJob(supabase, logEvent, LOG_PREFIX);

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
          const result = await deliverEmailJob({
            job,
            supabase,
            resendApiKey: RESEND_API_KEY,
            logEvent,
            updateJob: safeUpdateJob,
            logPrefix: LOG_PREFIX,
          });

          if (result.outcome === "sent") sent++;
          else if (result.outcome === "failed") failed++;
          else if (result.outcome === "retried") retried++;
          else skipped++;
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
