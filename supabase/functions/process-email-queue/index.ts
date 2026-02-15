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
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#27272a;background:#f4f4f5;}
.outer{max-width:600px;margin:0 auto;padding:24px 16px;}
.card{background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;}
.header{padding:28px 24px 20px;text-align:center;border-bottom:1px solid #e4e4e7;}
.wordmark{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:600;letter-spacing:-0.01em;}
.wordmark-blue{color:#0E56F5;}
.wordmark-gray{color:#94A3B8;}
.blue-line{display:block;width:48px;height:3px;background:#0E56F5;border-radius:2px;margin:12px auto 0;}
.content{padding:28px 24px 32px;}
.content h2{font-size:20px;font-weight:600;color:#18181b;margin:0 0 16px;}
.content p{margin:0 0 12px;color:#3f3f46;}
.cta-wrap{margin:28px 0 0;text-align:center;}
.cta{display:inline-block;padding:14px 28px;background:#0F172A;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;letter-spacing:0.01em;}
.cta-dot{display:inline-block;width:8px;height:8px;background:#10B981;border-radius:50%;margin-right:8px;vertical-align:middle;}
.cta-arrow{margin-left:8px;vertical-align:middle;}
.quote-block{background:#f4f4f5;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #0E56F5;}
.quote-block p{margin:0;color:#3f3f46;font-style:italic;}
.footer{padding:20px 24px;text-align:center;font-size:12px;color:#71717a;border-top:1px solid #e4e4e7;}
.footer a{color:#0E56F5;text-decoration:none;}
.footer p{margin:4px 0;}
</style></head><body>
<div class="outer"><div class="card">
<div class="header">
  <span class="wordmark"><span class="wordmark-blue">All Agent </span><span class="wordmark-gray">Connect</span></span>
  <span class="blue-line"></span>
</div>
<div class="content">${content}</div>
<div class="footer">
  <p>All Agent Connect – Complete Transparency in Real Estate</p>
  <p>Questions? <a href="mailto:hello@allagentconnect.com">hello@allagentconnect.com</a></p>
  <p style="margin-top:8px;"><a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account">Remove my account</a></p>
</div>
</div></div>
</body></html>`;

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
        <div class="cta-wrap"><a href="${variables.hotSheetLink}" class="cta"><span class="cta-dot"></span>View Hot Sheet<span class="cta-arrow">&rarr;</span></a></div>`);

    case "favorites-share":
      return wrapHtml(`
        <h2>Favorite Properties Shared With You</h2>
        <p>${variables.senderName} wants to share some properties they've been looking at:</p>
        ${variables.propertiesHtml || ""}
        <div class="cta-wrap"><a href="${variables.shareLink}" class="cta"><span class="cta-dot"></span>View All Properties<span class="cta-arrow">&rarr;</span></a></div>`);

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
        <div class="cta-wrap"><a href="${variables.viewLink}" class="cta"><span class="cta-dot"></span>View Property<span class="cta-arrow">&rarr;</span></a></div>`);

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

    case "hot-sheet-agent-reply":
      return wrapHtml(`
        <h2>New Update in Your Hot Sheet</h2>
        <p>Hi ${variables.clientName},</p>
        <p><strong>${variables.agentName}</strong> posted an update about
           <strong>${variables.listingAddress}</strong> in
           "${variables.hotSheetName}":</p>
        <div class="quote-block">
          <p>"${variables.commentPreview}"</p>
        </div>
        ${variables.conversationUrl ? `<div class="cta-wrap"><a href="${variables.conversationUrl}" class="cta"><span class="cta-dot"></span>View Conversation<span class="cta-arrow">&rarr;</span></a></div>` : '<p>Log in to view the full conversation.</p>'}`);
    case "hot-sheet-comment":
      return wrapHtml(`
        <h2>New Comment on Your Hot Sheet</h2>
        <p>Hi ${variables.agentName},</p>
        <p><strong>${variables.clientName}</strong> commented on
           <strong>${variables.listingAddress}</strong> in
           "${variables.hotSheetName}":</p>
        <div class="quote-block">
          <p>"${variables.commentPreview}"</p>
        </div>
        ${variables.conversationUrl ? `<div class="cta-wrap"><a href="${variables.conversationUrl}" class="cta"><span class="cta-dot"></span>View Conversation<span class="cta-arrow">&rarr;</span></a></div>` : '<p>Log in to your dashboard to view and respond.</p>'}`);
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
  const FROM_EMAIL = Deno.env.get("RESEND_FROM") || "hello@mail.allagentconnect.com";
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
