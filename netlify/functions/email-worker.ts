import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { renderCompactListingEmailCard } from "./listingEmailCard";

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

interface ProcessResult {
  jobId: string;
  success: boolean;
  error?: string;
}

/** Multipart text part — html-only hurts deliverability (SpamAssassin / Outlook). */
function htmlToPlainText(html: string): string {
  if (!html) return "";
  let out = html;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(
    /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href, label) => {
      const text = String(label).replace(/<[^>]+>/g, "").trim();
      if (!text) return href;
      if (text === href) return href;
      return `${text} (${href})`;
    },
  );
  out = out.replace(/<\/(p|div|tr|h[1-6]|li|blockquote)>/gi, "\n");
  out = out.replace(/<br\s*\/?>(?!\n)/gi, "\n");
  out = out.replace(/<[^>]+>/g, "");
  out = out
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  out = out.replace(/[ \t]+/g, " ");
  out = out.replace(/\n[ \t]+/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

// Email template renderer - builds HTML from template name and variables
function renderEmailTemplate(template: string, variables: Record<string, any>): string {
  // For templates that include pre-rendered HTML, use it directly
  if (variables.html) {
    return variables.html;
  }

  // Default wrapper for simple templates
  const wrapHtml = (content: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0F172A; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; background: #2754C5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>All Agent Connect</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>All Agent Connect - Revolutionizing Real Estate Through Complete Transparency</p>
        </div>
      </div>
    </body>
    </html>
  `;

  switch (template) {
    // listing-share template removed (Jun 2026) — Supabase renderEmailTemplate
    // is the only source of truth for listing share HTML. This worker is
    // disabled at the handler level; the case is gone so a future re-enable
    // can never resurrect the old "Property Shared With You" body.
    case "hot-sheet-alert":
      return wrapHtml(`
        <h2>New Properties Match Your Hot Sheet!</h2>
        <p>Hi ${variables.userName},</p>
        <p>We found new listings matching your Hot Sheet "${variables.hotSheetName}":</p>
        ${variables.listingsHtml || ""}
        <p>Don't miss out on these opportunities!</p>
      `);

    case "hot-sheet-invite":
      return wrapHtml(`
        <h2>You've Been Invited to View a Hot Sheet</h2>
        <p>${variables.inviterName} has shared their Hot Sheet "${variables.hotSheetName}" with you.</p>
        <p><a href="${variables.hotSheetLink}" class="button">View Hot Sheet</a></p>
      `);

    case "favorites-share":
      return wrapHtml(`
        <h2>Favorite Properties Shared With You</h2>
        <p>${variables.senderName} wants to share some properties they've been looking at:</p>
        ${variables.propertiesHtml || ""}
        <p><a href="${variables.shareLink}" class="button">View All Properties</a></p>
      `);

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
        ${variables.description ? `<p><strong>Details:</strong> ${variables.description}</p>` : ""}
        <p>Log in to your dashboard to connect with this buyer.</p>
      `);

    case "client-need-notification":
      return wrapHtml(`
        <h2>New Client Need Match</h2>
        <p>Hi ${variables.agentName},</p>
        <p>A new client need matches your preferences:</p>
        ${variables.contentHtml || ""}
      `);

    case "seller-alert":
      return wrapHtml(`
        <h2>New Property Matches Your Criteria!</h2>
        <p>Hi ${variables.agentName},</p>
        <p>A new property submission matches your Hot Sheet criteria:</p>
        ${variables.propertyHtml || ""}
        <p><a href="${variables.viewLink}" class="button">View Property</a></p>
      `);

    case "reverse-prospecting":
      return wrapHtml(`
        <h2>Reverse Prospecting Alert</h2>
        <p>${variables.contentHtml || ""}</p>
      `);

    case "bulk-email":
      return wrapHtml(variables.contentHtml || variables.message || "");

    case "new-match-notification":
      return wrapHtml(`
        <h2>New Matching Listings!</h2>
        <p>Hi ${variables.userName},</p>
        <p>We found ${variables.matchCount} new listings matching your Hot Sheet "${variables.hotSheetName}":</p>
        ${variables.listingsHtml || ""}
      `);

    case "hot-sheet-comment":
      return wrapHtml(`
        <h2>New Client Comment</h2>
        <p>Hi ${variables.agentName},</p>
        <p><strong>${variables.clientName}</strong> left a comment on a listing in your Hot Sheet "<strong>${variables.hotSheetName}</strong>":</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #2754C5;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #666;">Re: ${variables.listingAddress}</p>
          <p style="margin: 0;">"${variables.commentPreview}"</p>
        </div>
        <p>Log in to your dashboard to view and respond.</p>
      `);

    case "new-message-notification": {
      const senderName = String(variables.sender_name || "Someone");
      const messageBodyRaw = String(variables.message_body || "");
      const ctaUrl = String(variables.cta_url || "/messages");
      const preview = (messageBodyRaw || "").replace(/\s+/g, " ").trim().slice(0, 90);

      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const safeBody = escapeHtml(messageBodyRaw).replace(/\n/g, "<br>");
      const safeSender = escapeHtml(senderName);

      const initials = safeSender
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("") || "?";

      const appUrl = process.env.APP_URL || "https://allagentconnect.com";
      const ctaHref = ctaUrl.startsWith("http")
        ? ctaUrl
        : `${appUrl}${ctaUrl.startsWith("/") ? "" : "/"}${ctaUrl}`;
      const preheader = escapeHtml(preview || "You have a new message.");

      const listing =
        variables.listing && typeof variables.listing === "object" && variables.listing.id
          ? variables.listing
          : null;
      let listingCardHtml = "";
      if (listing) {
        const listingPath =
          typeof variables.listing_url === "string" && variables.listing_url.trim()
            ? variables.listing_url.trim()
            : variables.recipient_role === "buyer"
              ? `/consumer-property/${listing.id}`
              : `/property/${listing.id}`;
        const listingHref = listingPath.startsWith("http")
          ? listingPath
          : `${appUrl}${listingPath.startsWith("/") ? listingPath : `/${listingPath}`}`;
        listingCardHtml = renderCompactListingEmailCard(listing, {
          baseUrl: appUrl,
          listingUrl: listingHref,
          ctaLabel: "View listing",
          greenCta: true,
        });
      }

      const messageSection = `
                <tr>
                  <td style="padding:0 24px 20px;">
                    ${listingCardHtml ? `<p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Message</p>` : ""}
                    <div class="quote" style="background:#f8fafc; border-left:4px solid #0E56F5; border-radius:0 8px 8px 0; padding:16px; font-size:15px; line-height:1.6; color:#334155;">
                      ${safeBody || escapeHtml("You have a new message.")}
                    </div>
                  </td>
                </tr>`;

      return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>New message from ${safeSender}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .bg { background:#0b1220 !important; }
      .card { background:#0f172a !important; }
      .text { color:#e5e7eb !important; }
      .muted { color:#94a3b8 !important; }
      .border { border-color:#1f2937 !important; }
      .quote { background:#0b1220 !important; border-color:#1f2937 !important; }
      .chip { background:#0b1220 !important; border-color:#1f2937 !important; color:#cbd5e1 !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <!-- Preheader -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#f8fafc;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Wordmark Header -->
          <tr>
            <td style="padding:0 0 24px 0; text-align:center;">
              <span style="font-size:18px; font-weight:800; letter-spacing:-0.03em;">
                <span style="color:#0E56F5;">All Agent</span><span style="color:#94A3B8;">&nbsp;Connect</span>
              </span>
              <div style="width:40px; height:3px; background:#0E56F5; margin:8px auto 0; border-radius:2px;"></div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card" style="background:#ffffff; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Sender row -->
                <tr>
                  <td style="padding:24px 24px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:44px; vertical-align:top;">
                          <div style="width:44px; height:44px; border-radius:50%; background:#0E56F5; color:#ffffff; font-size:16px; font-weight:700; line-height:44px; text-align:center;">
                            ${escapeHtml(initials)}
                          </div>
                        </td>
                        <td style="padding-left:14px; vertical-align:center;">
                          <div class="text" style="font-size:16px; font-weight:700; color:#0f172a; line-height:1.3;">
                            New message from ${safeSender}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${listingCardHtml ? `<tr><td style="padding:0 24px 8px;">${listingCardHtml}</td></tr>` : ""}

                ${messageSection}

                <!-- CTA -->
                <tr>
                  <td style="padding:0 24px 28px; text-align:center;">
                    <a href="${ctaHref}" target="_blank" style="display:inline-block; background:#50c878; color:#ffffff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none; letter-spacing:0.01em;">
                      View Conversation&nbsp;&nbsp;&rarr;
                    </a>
                    <div class="muted" style="font-size:11px; color:#94a3b8; margin-top:10px; word-break:break-all;">
                      If the button doesn&rsquo;t work, open: ${escapeHtml(ctaHref)}
                    </div>
                  </td>
                </tr>

                <!-- Footer inside card -->
                <tr>
                  <td class="border" style="border-top:1px solid #e5e7eb; padding:20px 24px;">
                    <div class="muted" style="font-size:12px; color:#94a3b8; text-align:center; line-height:1.6;">
                      All Agent Connect &mdash; Private Agent Network<br>
                      Questions? <a href="mailto:hello@notify.allagentconnect.com" style="color:#0E56F5; font-weight:700;">hello@notify.allagentconnect.com</a>
                    </div>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Copyright -->
          <tr>
            <td style="padding:20px 0 0; text-align:center;">
              <div class="muted" style="font-size:11px; color:#94a3b8;">
                &copy; ${new Date().getFullYear()} All Agent Connect
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    default:
      // Fallback: use html from variables or a simple message
      return wrapHtml(variables.contentHtml || variables.message || `<p>Email template: ${template}</p>`);
  }
}

async function sendEmail(job: EmailJob, resendApiKey: string): Promise<void> {
  const { payload } = job;

  // Hard-lock — never read From from Netlify env (proven drift vector).
  // TEMP REVERT (Jun 2026): back on the verified `mail.allagentconnect.com`
  // subdomain until the root `allagentconnect.com` domain is verified in Resend.
  const canonicalFrom = "All Agent Connect <hello@notify.allagentconnect.com>";
  
  // Normalize recipients: handle string, array, or comma-separated string
  const toList: string[] = Array.isArray(payload.to)
    ? payload.to
    : typeof payload.to === "string"
      ? payload.to.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  if (toList.length === 0) {
    throw new Error("No valid recipients in payload.to");
  }

  // Render the HTML from template
  const html = payload.html || renderEmailTemplate(payload.template, payload.variables || {});

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: canonicalFrom,
      to: toList,
      subject: payload.subject,
      html,
      text: htmlToPlainText(html),
      reply_to: payload.reply_to,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Resend API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }
}

function calculateBackoff(attempts: number): number {
  // Exponential backoff: min(3600, 30 * 2^attempts) seconds
  return Math.min(3600, 30 * Math.pow(2, attempts));
}

const handler: Handler = async (_event: HandlerEvent, _context: HandlerContext) => {
  // Queue drained by Supabase process-email-queue only (netlify.toml schedule disabled).
  console.log("[email-worker] Disabled — use Supabase process-email-queue");
  return {
    statusCode: 200,
    body: JSON.stringify({ processed: 0, disabled: true }),
  };

  /* eslint-disable no-unreachable -- legacy worker body kept for reference */
  console.log("[email-worker] Starting email queue processing");

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[email-worker] Missing required environment variables");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Claim up to 50 jobs atomically
    const { data: jobs, error: claimError } = await supabase.rpc("email_jobs_claim", {
      p_limit: 50,
    });

    if (claimError) {
      console.error("[email-worker] Failed to claim jobs:", claimError);
      throw claimError;
    }

    if (!jobs || jobs.length === 0) {
      console.log("[email-worker] No jobs to process");
      return {
        statusCode: 200,
        body: JSON.stringify({ processed: 0, sent: 0, failed: 0 }),
      };
    }

    console.log(`[email-worker] Claimed ${jobs.length} jobs`);

    const results: ProcessResult[] = [];

    // Process jobs with controlled concurrency (5 at a time)
    const CONCURRENCY = 5;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const batch = jobs.slice(i, i + CONCURRENCY);
      
      const batchResults = await Promise.all(
        batch.map(async (job: EmailJob): Promise<ProcessResult> => {
          try {
            await sendEmail(job, RESEND_API_KEY);

            // Mark as sent
            await supabase
              .from("email_jobs")
              .update({ status: "sent" })
              .eq("id", job.id);

            // Log success event
            await supabase.from("email_events").insert({
              job_id: job.id,
              event: "sent",
              detail: { to: job.payload.to, template: job.payload.template },
            });

            console.log(`[email-worker] Job ${job.id} sent successfully`);
            return { jobId: job.id, success: true };

          } catch (error: any) {
            const errorMessage = error.message || String(error);
            console.error(`[email-worker] Job ${job.id} failed:`, errorMessage);

            if (job.attempts < job.max_attempts) {
              // Requeue with exponential backoff
              const backoffSeconds = calculateBackoff(job.attempts);
              const runAfter = new Date(Date.now() + backoffSeconds * 1000).toISOString();

              await supabase
                .from("email_jobs")
                .update({
                  status: "queued",
                  run_after: runAfter,
                  last_error: errorMessage,
                })
                .eq("id", job.id);

              // Log retry event
              await supabase.from("email_events").insert({
                job_id: job.id,
                event: "retry_scheduled",
                detail: { 
                  error: errorMessage, 
                  attempt: job.attempts, 
                  next_run: runAfter,
                  backoff_seconds: backoffSeconds,
                },
              });

              console.log(`[email-worker] Job ${job.id} scheduled for retry at ${runAfter}`);
            } else {
              // Mark as permanently failed
              await supabase
                .from("email_jobs")
                .update({
                  status: "failed",
                  last_error: errorMessage,
                })
                .eq("id", job.id);

              // Log failure event
              await supabase.from("email_events").insert({
                job_id: job.id,
                event: "failed",
                detail: { 
                  error: errorMessage, 
                  attempts: job.attempts,
                  max_attempts: job.max_attempts,
                },
              });

              console.log(`[email-worker] Job ${job.id} permanently failed after ${job.attempts} attempts`);
            }

            return { jobId: job.id, success: false, error: errorMessage };
          }
        })
      );

      results.push(...batchResults);

      // Small delay between batches to avoid rate limits
      if (i + CONCURRENCY < jobs.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`[email-worker] Processed ${jobs.length} jobs: ${sent} sent, ${failed} failed/retried`);

    return {
      statusCode: 200,
      body: JSON.stringify({ processed: jobs.length, sent, failed }),
    };

  } catch (error: any) {
    console.error("[email-worker] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export { handler };