// @auth-classification: internal-cron (service-role bearer only; exact-job-ID delivery)
/**
 * Exact-job-ID email delivery. Service-role only.
 *
 * Processes exactly ONE `email_jobs.id`. There is no batch mode, no fallback,
 * and no path that can touch a second row:
 *   - the service-role bearer is verified BEFORE body parsing, any database
 *     access, any claim, and any provider access;
 *   - the row is validated against an explicit allowlist before claiming;
 *   - the claim is a conditional single-row UPDATE (id + queued + hot_sheet);
 *   - the batch RPC `email_jobs_claim` is never called;
 *   - pause switches are rechecked immediately before the provider call
 *     (inside the shared delivery core).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { EmailJob } from "../_shared/emailTypes.ts";
import { authorizeInternalServiceRole } from "../_shared/internalServiceRoleAuth.ts";
import {
  deliverEmailJob,
  makeLogEvent,
  makeSafeUpdateJob,
  toErrorMessage,
} from "../_shared/emailJobDelivery.ts";
import {
  findAllowlistEntryByJobId,
  parseSingleJobRequest,
  SINGLE_SEND_ALLOWED_STREAM,
  validateClaimedJobForSingleSend,
  validateJobForSingleSend,
} from "../_shared/singleEmailJobGuard.ts";
import { isGloballyPaused, isStreamPaused } from "../_shared/emailStreams.ts";

const LOG_PREFIX = "[send-single-email-job]";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Auth first — before body parsing, before any database access.
  const auth = authorizeInternalServiceRole(req);
  if (!auth.ok) {
    return json({ error: auth.error }, { status: auth.status });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // 2. Exact job_id required.
  let rawBody: unknown = null;
  try {
    rawBody = await req.json();
  } catch {
    return json({ error: "job_id_required" }, { status: 400 });
  }

  const parsed = parseSingleJobRequest(rawBody);
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
  const jobId = parsed.jobId;

  // 2b. Exact-UUID allowlist gate — before any Supabase client or query.
  const allowEntry = findAllowlistEntryByJobId(jobId);
  if (!allowEntry) {
    console.log(`${LOG_PREFIX} rejected ${jobId}: job_id_not_allowlisted`);
    return json(
      { error: "job_id_not_allowlisted", job_id: jobId, claimed: false, sent: false },
      { status: 403 },
    );
  }

  // 3. Pause gate before touching the database at all.
  if (isGloballyPaused()) {
    return json({
      paused: true,
      switch: "EMAIL_SENDING_PAUSED",
      job_id: jobId,
      final_status: "queued",
      sent: false,
    });
  }
  if (isStreamPaused(SINGLE_SEND_ALLOWED_STREAM)) {
    return json({
      paused: true,
      switch: "HOT_SHEET_EMAILS_PAUSED",
      job_id: jobId,
      final_status: "queued",
      sent: false,
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "config" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // 4. Read + validate the exact row before any write.
    const { data: row, error: readErr } = await supabase
      .from("email_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (readErr) throw readErr;

    const verdict = validateJobForSingleSend(row);
    if (!verdict.ok) {
      console.log(`${LOG_PREFIX} rejected ${jobId}: ${verdict.error}`);
      return json(
        {
          error: verdict.error,
          job_id: jobId,
          previous_status: row?.status ?? null,
          final_status: row?.status ?? null,
          claimed: false,
          sent: false,
        },
        { status: verdict.error === "job_not_found" ? 404 : 409 },
      );
    }

    const previousStatus = row.status as string;

    // 5. Atomic single-row claim. The WHERE clause is the concurrency guard:
    //    a second invocation finds status != 'queued' and claims nothing, so
    //    the same job can never be sent twice.
    const { data: claimed, error: claimErr } = await supabase
      .from("email_jobs")
      .update({
        status: "processing",
        attempts: (row.attempts ?? 0) + 1,
        run_after: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "queued")
      .eq("stream", SINGLE_SEND_ALLOWED_STREAM)
      .eq("idempotency_key", allowEntry.idempotency_key)
      .select("*");

    if (claimErr) throw claimErr;
    if (!claimed || claimed.length !== 1) {
      return json(
        {
          error: "claim_failed",
          job_id: jobId,
          previous_status: previousStatus,
          claimed_rows: claimed?.length ?? 0,
          sent: false,
        },
        { status: 409 },
      );
    }

    const job = claimed[0] as EmailJob;

    // 5b. Re-validate the claimed row before any provider call. Any mismatch
    //     rolls the row back to queued and returns fail-closed.
    const claimedVerdict = validateClaimedJobForSingleSend(job as never);
    if (!claimedVerdict.ok) {
      console.error(
        `${LOG_PREFIX} claimed-row mismatch ${jobId}: ${claimedVerdict.error}`,
      );
      await supabase
        .from("email_jobs")
        .update({ status: "queued", attempts: row.attempts ?? 0 })
        .eq("id", jobId)
        .eq("status", "processing");
      return json(
        {
          error: "claimed_row_validation_failed",
          reason: claimedVerdict.error,
          job_id: jobId,
          previous_status: previousStatus,
          final_status: "queued",
          claimed: false,
          sent: false,
        },
        { status: 409 },
      );
    }

    // 6. Deliver through the single shared delivery core (rendering, pre-send
    //    pause recheck, sendEmail, event logging, retry, sent/failed update).
    const logEvent = makeLogEvent(supabase, LOG_PREFIX, "single-job");
    const updateJob = makeSafeUpdateJob(supabase, logEvent, LOG_PREFIX);

    const result = await deliverEmailJob({
      job,
      supabase,
      resendApiKey: RESEND_API_KEY,
      logEvent,
      updateJob,
      logPrefix: LOG_PREFIX,
    });

    const { data: finalRow } = await supabase
      .from("email_jobs")
      .select("status, provider_message_id")
      .eq("id", jobId)
      .maybeSingle();

    return json({
      success: result.outcome === "sent",
      job_id: jobId,
      previous_status: previousStatus,
      final_status: finalRow?.status ?? null,
      outcome: result.outcome,
      reason: result.reason ?? null,
      error: result.error ?? null,
      provider_message_id:
        result.providerMessageId ?? finalRow?.provider_message_id ?? null,
      sent: result.outcome === "sent",
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} error:`, err);
    return json({ error: toErrorMessage(err), job_id: jobId }, { status: 500 });
  }
});