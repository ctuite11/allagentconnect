import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EmailJob {
  id: string;
  created_at: string;
  run_after: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  payload: {
    provider: string;
    template: string;
    to: string | string[];
    subject: string;
    html?: string;
    reply_to?: string;
    variables?: Record<string, any>;
  };
}

/* ------------------------------------------------------------------ */
/*  Template renderer (ported from netlify/functions/email-worker.ts)  */
/* ------------------------------------------------------------------ */

function renderEmailTemplate(
  template: string,
  variables: Record<string, any>,
): string {
  if (variables.html) return variables.html;

  const wrapHtml = (content: string) => `
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333}
.container{max-width:600px;margin:0 auto;padding:20px}
.header{background:#0F172A;color:white;padding:20px;text-align:center}
.content{padding:20px}
.footer{background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#666}
.button{display:inline-block;background:#2754C5;color:white;padding:12px 24px;text-decoration:none;border-radius:4px}
</style></head><body><div class="container">
<div class="header"><h1>All Agent Connect</h1></div>
<div class="content">${content}</div>
<div class="footer"><p>All Agent Connect – Revolutionizing Real Estate Through Complete Transparency</p></div>
</div></body></html>`;

  switch (template) {
    case "listing-share":
      return wrapHtml(`
        <h2>Property Shared With You</h2>
        ${variables.photoUrl ? `<img src="${variables.photoUrl}" alt="Property" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;" />` : ""}
        <p><strong>Address:</strong> ${variables.address}</p>
        <p><strong>Price:</strong> ${variables.price}</p>
        ${variables.bedrooms ? `<p><strong>Bedrooms:</strong> ${variables.bedrooms}</p>` : ""}
        ${variables.bathrooms ? `<p><strong>Bathrooms:</strong> ${variables.bathrooms}</p>` : ""}
        ${variables.message ? `<p><strong>Message:</strong> ${variables.message}</p>` : ""}
        <p>Contact ${variables.agentName} at ${variables.agentEmail} for more information.</p>`);

    case "hot-sheet-alert":
      return wrapHtml(`
        <h2>New Properties Match Your Hot Sheet!</h2>
        <p>Hi ${variables.userName},</p>
        <p>We found new listings matching your Hot Sheet "${variables.hotSheetName}":</p>
        ${variables.listingsHtml || ""}
        <p>Don't miss out on these opportunities!</p>`);

    case "hot-sheet-invite":
      return wrapHtml(`
        <h2>You've Been Invited to View a Hot Sheet</h2>
        <p>${variables.inviterName} has shared their Hot Sheet "${variables.hotSheetName}" with you.</p>
        <p><a href="${variables.hotSheetLink}" class="button">View Hot Sheet</a></p>`);

    case "favorites-share":
      return wrapHtml(`
        <h2>Favorite Properties Shared With You</h2>
        <p>${variables.senderName} wants to share some properties they've been looking at:</p>
        ${variables.propertiesHtml || ""}
        <p><a href="${variables.shareLink}" class="button">View All Properties</a></p>`);

    case "buyer-alert":
      return wrapHtml(`
        <h2>New Buyer Alert</h2>
        <p>Hi ${variables.agentName},</p>
        <p>A new buyer is looking for properties in ${variables.location}!</p>
        <ul>
          <li><strong>Property Type:</strong> ${variables.propertyType}</li>
          <li><strong>Max Price:</strong> ${variables.maxPrice}</li>
          ${variables.bedrooms ? `<li><strong>Bedrooms:</strong> ${variables.bedrooms}+</li>` : ""}
          ${variables.bathrooms ? `<li><strong>Bathrooms:</strong> ${variables.bathrooms}+</li>` : ""}
        </ul>
        ${variables.description ? `<p><strong>Details:</strong> ${variables.description}</p>` : ""}`);

    case "client-need-notification":
      return wrapHtml(`
        <h2>New Client Need Match</h2>
        <p>Hi ${variables.agentName},</p>
        <p>A new client need matches your preferences:</p>
        ${variables.contentHtml || ""}`);

    case "seller-alert":
      return wrapHtml(`
        <h2>New Property Matches Your Criteria!</h2>
        <p>Hi ${variables.agentName},</p>
        <p>A new property submission matches your Hot Sheet criteria:</p>
        ${variables.propertyHtml || ""}
        <p><a href="${variables.viewLink}" class="button">View Property</a></p>`);

    case "reverse-prospecting":
      return wrapHtml(`<h2>Reverse Prospecting Alert</h2><p>${variables.contentHtml || ""}</p>`);

    case "bulk-email":
      return wrapHtml(variables.contentHtml || variables.message || "");

    case "new-match-notification":
      return wrapHtml(`
        <h2>New Matching Listings!</h2>
        <p>Hi ${variables.userName},</p>
        <p>We found ${variables.matchCount} new listings matching your Hot Sheet "${variables.hotSheetName}":</p>
        ${variables.listingsHtml || ""}`);

    case "hot-sheet-comment":
      return wrapHtml(`
        <h2>New Client Comment</h2>
        <p>Hi ${variables.agentName},</p>
        <p><strong>${variables.clientName}</strong> left a comment on a listing in your Hot Sheet "<strong>${variables.hotSheetName}</strong>":</p>
        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #2754C5;">
          <p style="margin:0 0 8px 0;font-size:13px;color:#666;">Re: ${variables.listingAddress}</p>
          <p style="margin:0;">"${variables.commentPreview}"</p>
        </div>
        <p>Log in to your dashboard to view and respond.</p>`);

    default:
      return wrapHtml(
        variables.contentHtml ||
          variables.message ||
          `<p>Email template: ${template}</p>`,
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function calculateBackoff(attempts: number): number {
  return Math.min(3600, 30 * Math.pow(2, attempts));
}

async function sendEmail(
  job: EmailJob,
  resendApiKey: string,
): Promise<void> {
  const FROM_EMAIL = Deno.env.get("RESEND_FROM") || "hello@allagentconnect.com";
  const FROM_NAME =
    Deno.env.get("RESEND_FROM_NAME") || "All Agent Connect";

  const toList: string[] = Array.isArray(job.payload.to)
    ? job.payload.to
    : typeof job.payload.to === "string"
      ? job.payload.to
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  if (toList.length === 0) throw new Error("No valid recipients");

  const html =
    job.payload.html ||
    renderEmailTemplate(job.payload.template, job.payload.variables || {});

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: toList,
      subject: job.payload.subject,
      html,
      reply_to: job.payload.reply_to,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Resend API ${res.status}: ${JSON.stringify(err)}`,
    );
  }
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
