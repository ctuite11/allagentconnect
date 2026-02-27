import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { EmailJob } from "../_shared/emailTypes.ts";
import { sendEmail } from "../_shared/sendEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function calculateBackoff(attempts: number): number {
  return Math.min(3600, 30 * Math.pow(2, attempts));
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                       */
/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    console.error("[process-email-queue] Missing env vars");
    return new Response(JSON.stringify({ error: "config" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Claim jobs
    const { data: jobs, error: claimErr } = await supabase.rpc(
      "email_jobs_claim",
      { p_limit: 50 },
    );

    if (claimErr) throw claimErr;
    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, sent: 0, failed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[process-email-queue] Claimed ${jobs.length} jobs`);

    let sent = 0;
    let failed = 0;
    const CONCURRENCY = 5;

    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const batch = jobs.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async (job: EmailJob) => {
          try {
            await sendEmail(job, RESEND_API_KEY);

            await supabase
              .from("email_jobs")
              .update({ status: "sent" })
              .eq("id", job.id);

            await supabase.from("email_events").insert({
              job_id: job.id,
              event: "sent",
              detail: {
                to: job.payload.to,
                template: job.payload.template,
              },
            });

            sent++;
          } catch (err: any) {
            const msg = err.message || String(err);
            console.error(`[process-email-queue] Job ${job.id} failed:`, msg);

            if (job.attempts < job.max_attempts) {
              const backoff = calculateBackoff(job.attempts);
              const runAfter = new Date(
                Date.now() + backoff * 1000,
              ).toISOString();

              await supabase
                .from("email_jobs")
                .update({
                  status: "queued",
                  run_after: runAfter,
                  last_error: msg,
                })
                .eq("id", job.id);

              await supabase.from("email_events").insert({
                job_id: job.id,
                event: "retry_scheduled",
                detail: {
                  error: msg,
                  attempt: job.attempts,
                  next_run: runAfter,
                },
              });
            } else {
              await supabase
                .from("email_jobs")
                .update({ status: "failed", last_error: msg })
                .eq("id", job.id);

              await supabase.from("email_events").insert({
                job_id: job.id,
                event: "failed",
                detail: {
                  error: msg,
                  attempts: job.attempts,
                  max_attempts: job.max_attempts,
                },
              });
            }

            failed++;
          }
        }),
      );

      if (i + CONCURRENCY < jobs.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    console.log(
      `[process-email-queue] Done: ${sent} sent, ${failed} failed/retried`,
    );

    return new Response(
      JSON.stringify({ processed: jobs.length, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[process-email-queue] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
