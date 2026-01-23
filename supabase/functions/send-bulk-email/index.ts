import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  recipients: Array<{ email: string; name: string }>;
  subject: string;
  message: string;
  agentId: string;
  agentEmail?: string;
  sendAsGroup?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  current_count: number;
}

async function checkRateLimit(
  key: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('rate_limit_consume', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (error) {
    console.error("[rate-limit] RPC error:", error);
    return { allowed: true, remaining: limit, reset_at: new Date().toISOString(), current_count: 0 };
  }

  // Handle array or single object return from RPC
  const row = Array.isArray(data) ? data[0] : data;
  return row as RateLimitResult;
}

function build429Response(resetAt: string): Response {
  const resetDate = new Date(resetAt);
  const retryAfter = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 1000));
  
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(resetDate.getTime() / 1000)),
    },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, message, agentId, agentEmail, sendAsGroup = false }: BulkEmailRequest = await req.json();

    console.log(`[send-bulk-email] Enqueuing bulk email to ${recipients.length} recipients`);

    if (!recipients || recipients.length === 0) {
      throw new Error("No recipients provided");
    }

    if (!subject || !message) {
      throw new Error("Subject and message are required");
    }

    if (!agentId) {
      throw new Error("Agent ID is required");
    }

    // Cap recipients to prevent abuse
    if (recipients.length > 100) {
      throw new Error("Maximum 100 recipients allowed per bulk email");
    }

    // Database-backed rate limiting: 2 bulk email campaigns per minute per user
    const rateLimitKey = `route:send-bulk-email|user:${agentId}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 60, 2);
    
    if (!rateLimitResult.allowed) {
      console.log(`[rate-limit] Blocked user: ${agentId}, count: ${rateLimitResult.current_count}`);
      return build429Response(rateLimitResult.reset_at);
    }

    // Create email campaign record for tracking
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .insert({
        agent_id: agentId,
        subject,
        message,
        recipient_count: recipients.length,
      })
      .select()
      .single();

    if (campaignError) {
      console.error("[send-bulk-email] Error creating campaign:", campaignError);
      throw new Error("Failed to create campaign");
    }

    console.log("[send-bulk-email] Created campaign:", campaign.id);

    // Build email HTML template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .content {
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          <div class="content">
            {{GREETING}}
            <p>${message.replace(/\n/g, '<br>')}</p>
          </div>
        </body>
      </html>
    `;

    // For group sends (small groups), create a single job with all recipients
    if (sendAsGroup && recipients.length < 5) {
      console.log("[send-bulk-email] Enqueuing as group email");

      // Create email send record for tracking
      const { data: emailSend } = await supabase
        .from("email_sends")
        .insert({
          campaign_id: campaign.id,
          recipient_email: recipients[0].email,
          recipient_name: "Group Email",
        })
        .select()
        .single();

      const trackingPixelUrl = emailSend 
        ? `${supabaseUrl}/functions/v1/track-email-open?id=${emailSend.id}`
        : "";

      const groupHtml = htmlTemplate.replace("{{GREETING}}", "") + 
        (trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />` : "");

      // Enqueue single group job
      const { error: insertError } = await supabase
        .from("email_jobs")
        .insert({
          payload: {
            provider: "resend",
            template: "bulk-email-group",
            to: recipients.map(r => r.email).join(","), // Worker will split this
            subject: subject,
            html: groupHtml,
            reply_to: agentEmail,
            variables: {
              campaignId: campaign.id,
              isGroup: true,
              recipients: recipients,
            },
          },
        });

      if (insertError) {
        console.error("[send-bulk-email] Failed to enqueue group job:", insertError);
        throw new Error("Failed to queue email for sending");
      }

      return new Response(
        JSON.stringify({
          success: true,
          queued: 1,
          total: recipients.length,
          mode: "group",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // For individual sends, create one job per recipient
    const emailJobs = await Promise.all(
      recipients.map(async (recipient) => {
        // Create email send record for tracking
        const { data: emailSend } = await supabase
          .from("email_sends")
          .insert({
            campaign_id: campaign.id,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
          })
          .select()
          .single();

        const trackingPixelUrl = emailSend 
          ? `${supabaseUrl}/functions/v1/track-email-open?id=${emailSend.id}`
          : "";

        const personalizedHtml = htmlTemplate
          .replace("{{GREETING}}", `<p>Hello ${recipient.name},</p>`) +
          (trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />` : "");

        return {
          payload: {
            provider: "resend",
            template: "bulk-email",
            to: recipient.email,
            subject: subject,
            html: personalizedHtml,
            reply_to: agentEmail,
            variables: {
              recipientName: recipient.name,
              campaignId: campaign.id,
              emailSendId: emailSend?.id,
            },
          },
        };
      })
    );

    // Insert all jobs into the queue
    const { error: insertError } = await supabase
      .from("email_jobs")
      .insert(emailJobs);

    if (insertError) {
      console.error("[send-bulk-email] Failed to enqueue jobs:", insertError);
      throw new Error("Failed to queue emails for sending");
    }

    console.log(`[send-bulk-email] Successfully enqueued ${emailJobs.length} jobs`);

    return new Response(
      JSON.stringify({
        success: true,
        queued: emailJobs.length,
        total: recipients.length,
        campaignId: campaign.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[send-bulk-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);