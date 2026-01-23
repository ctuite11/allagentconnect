import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

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
    case "listing-share":
      return wrapHtml(`
        <h2>Property Shared With You</h2>
        ${variables.photoUrl ? `<img src="${variables.photoUrl}" alt="Property" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px;" />` : ""}
        <p><strong>Address:</strong> ${variables.address}</p>
        <p><strong>Price:</strong> ${variables.price}</p>
        ${variables.bedrooms ? `<p><strong>Bedrooms:</strong> ${variables.bedrooms}</p>` : ""}
        ${variables.bathrooms ? `<p><strong>Bathrooms:</strong> ${variables.bathrooms}</p>` : ""}
        ${variables.message ? `<p><strong>Message:</strong> ${variables.message}</p>` : ""}
        <p>Contact ${variables.agentName} at ${variables.agentEmail} for more information.</p>
      `);

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

    default:
      // Fallback: use html from variables or a simple message
      return wrapHtml(variables.contentHtml || variables.message || `<p>Email template: ${template}</p>`);
  }
}

async function sendEmail(job: EmailJob, resendApiKey: string): Promise<void> {
  const { payload } = job;
  
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
      from: "All Agent Connect <hello@allagentconnect.com>",
      to: toList,
      subject: payload.subject,
      html,
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

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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