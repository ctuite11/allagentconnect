import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { EmailJob } from "../_shared/emailTypes.ts";
import { sendEmail } from "../_shared/sendEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  /* ---- Auth gate ---- */
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } =
    await anonClient.auth.getClaims(token);

  if (claimsErr || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /* ---- Env ---- */
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!RESEND_API_KEY || !SERVICE_KEY) {
    console.error("[kick-email-queue] Missing env vars");
    return new Response(JSON.stringify({ error: "config" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: jobs, error: claimErr } = await supabase.rpc(
      "email_jobs_claim",
      { p_limit: 5 },
    );

    if (claimErr) throw claimErr;
    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, sent: 0, failed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[kick-email-queue] Claimed ${jobs.length} jobs`);

    let sent = 0;
    let failed = 0;

    await Promise.all(
      jobs.map(async (job: EmailJob) => {
        try {
          await sendEmail(job, RESEND_API_KEY);

          await supabase
            .from("email_jobs")
            .update({ status: "sent" })
            .eq("id", job.id);

          await supabase.from("email_events").insert({
            job_id: job.id,
            event: "sent",
            detail: { to: job.payload.to, template: job.payload.template },
          });

          sent++;
        } catch (err: any) {
          const msg = err.message || String(err);
          console.error(`[kick-email-queue] Job ${job.id} failed:`, msg);

          if (job.attempts < job.max_attempts) {
            const backoff = Math.min(3600, 30 * Math.pow(2, job.attempts));
            const runAfter = new Date(Date.now() + backoff * 1000).toISOString();

            await supabase
              .from("email_jobs")
              .update({ status: "queued", run_after: runAfter, last_error: msg })
              .eq("id", job.id);
          } else {
            await supabase
              .from("email_jobs")
              .update({ status: "failed", last_error: msg })
              .eq("id", job.id);
          }

          failed++;
        }
      }),
    );

    console.log(`[kick-email-queue] Done: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ processed: jobs.length, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[kick-email-queue] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
