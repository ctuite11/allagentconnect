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
  template?: string;
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

const STORAGE_BASE = `${supabaseUrl}/storage/v1/object/public/email-attachments/early-access-v1`;
const STORAGE_BASE_V2 = `${supabaseUrl}/storage/v1/object/public/email-attachments/early-access-v2`;
const IMG_VERSION_V2 = "v4";
const AAC_LOGO_URL = `${supabaseUrl}/storage/v1/object/public/brand-assets/aac-logo-green-black-v4.png`;

function buildEarlyAccessUpdateBody(): string {
  const sections = [
    {
      img: `${STORAGE_BASE}/01-home.png`,
      title: "The new front door for elite real estate.",
      desc: "All Agent Connect is the private network where vetted agents share off-market opportunities, refer clients, and close faster — before listings ever touch the public market.",
      scenario: "Imagine an off-market $12.4M oceanfront estate in Watch Hill quietly surfacing to 240 vetted agents — before it ever hits Zillow.",
    },
    {
      img: `${STORAGE_BASE}/02-success-hub.png`,
      title: "Your Success Hub — every deal in one view.",
      desc: "Pipeline, buyer activity, listing performance, and live market signals on a single command center designed for top producers.",
      scenario: "Track 18 active buyers, 6 live listings, and a $42M pipeline — without juggling a single spreadsheet.",
    },
    {
      img: `${STORAGE_BASE}/03-comms.png`,
      title: "Communications Center — clients and colleagues, one inbox.",
      desc: "Email, message, and collaborate without leaving AAC. Every conversation tied to the right listing, buyer, or referral.",
      scenario: "A referral from a Greenwich agent, a question from your Nantucket buyer, and a co-broke thread on a Beacon Hill townhouse — all in one place.",
    },
    {
      img: `${STORAGE_BASE}/04-results.png`,
      title: "Results that move — MLS-grade search, AAC speed.",
      desc: "Find the right home or comp in seconds with rich filters, radius search, and live off-market inventory only AAC agents see.",
      scenario: "Pull every 4-bed waterfront under $5M within 10 miles of Newport — including the three off-market listings the public will never see.",
    },
    {
      img: `${STORAGE_BASE}/05-network.png`,
      title: "The Agent Referral Network — your trusted bench.",
      desc: "Discover and refer to top agents in any market. Every profile is verified, protected from cold scraping, and ready to send a deal your way.",
      scenario: "Send your relocating Boston client to a verified top producer in Aspen — and earn a referral fee on a $6.8M closing.",
    },
  ];

  const sectionHtml = sections.map((s, i) => `
    <tr><td style="padding:${i === 0 ? "8px" : "32px"} 0 0;">
      <img src="${s.img}" alt="${s.title}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px;" />
      <h2 style="margin:20px 0 8px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.25;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${s.title}</h2>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${s.desc}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;font-style:italic;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${s.scenario}</p>
    </td></tr>`).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;">
      <tr><td align="center" style="padding:0 0 24px;">
        <img src="${AAC_LOGO_URL}" alt="All Agent Connect" height="36" style="display:block;height:36px;width:auto;border:0;outline:none;" />
      </td></tr>
      <tr><td style="padding:0 0 8px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0E56F5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Early Access Update</p>
        <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;line-height:1.15;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">A first look inside All Agent Connect.</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Five new ways AAC is changing how top agents work together. Scenarios below are illustrative only.</p>
      </td></tr>
      ${sectionHtml}
      <tr><td align="center" style="padding:36px 0 8px;">
        <a href="https://allagentconnect.com/agent-dashboard" style="display:inline-block;padding:14px 28px;background:#0E56F5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Open your Success Hub</a>
      </td></tr>
      <tr><td style="padding:24px 0 0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You're receiving this because you registered for early access at allagentconnect.com.</p>
      </td></tr>
    </table>`;
}

function buildEarlyAccessUpdateV2Body(): string {
  const heroImg = `${STORAGE_BASE_V2}/01-home.png?v=${IMG_VERSION_V2}`;

  const rows: Array<{ img: string; title: string; desc: string; bullets: string[] }> = [
    {
      img: `${STORAGE_BASE_V2}/02-success-hub.png?v=${IMG_VERSION_V2}`,
      title: "Success Hub",
      desc: "One centralized place for buyers, listings, hot sheets, conversations, favorites, and referrals.",
      bullets: ["Buyer management", "Hot sheets & saved searches", "Listing visibility", "Internal collaboration", "Real-time activity", "Referral opportunities"],
    },
    {
      img: `${STORAGE_BASE_V2}/03-results.png?v=${IMG_VERSION_V2}`,
      title: "Search Results",
      desc: "Real-time market visibility. Search listings, map inventory, save hot sheets, and share opportunities instantly.",
      bullets: ["Interactive map search", "Real-time listing updates", "Save as hot sheet", "Share directly with agents"],
    },
    {
      img: `${STORAGE_BASE_V2}/04-comms.png?v=${IMG_VERSION_V2}`,
      title: "Communications Center",
      desc: "Straight to your email. Internal direct messaging built for active real estate collaboration.",
      bullets: ["Buyer needs", "Off-market opportunities", "Rental requests", "Referral discussions", "Sales intel"],
    },
    {
      img: `${STORAGE_BASE_V2}/05-network.png?v=${IMG_VERSION_V2}`,
      title: "Verified Agent Network",
      desc: "Relationships still matter. AAC helps agents connect directly with trusted professionals across markets and specialties.",
      bullets: ["Search by name or market", "View agent specialties", "Build trusted relationships", "Grow your network"],
    },
  ];

  const rowHtml = rows.map((r) => `
    <tr><td style="padding:32px 0 0;">
      <img src="${r.img}" alt="${r.title}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:10px;border:1px solid #94a3b8;" />
      <h2 style="margin:16px 0 10px;font-size:16px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#0f172a;line-height:1.3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${r.title}</h2>
      <div style="width:32px;height:2px;background:#22C55E;margin:0 0 12px;border-radius:1px;"></div>
      <p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${r.desc}</p>
      ${r.bullets.map(b => `<p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#22C55E;font-weight:700;">✓</span> ${b}</p>`).join("")}
    </td></tr>`).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;">
      <tr><td align="center" style="padding:0 0 24px;">
        <img src="${AAC_LOGO_URL}" alt="All Agent Connect" height="36" style="display:block;height:36px;width:auto;border:0;outline:none;" />
      </td></tr>
      <tr><td style="padding:0 0 16px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0E56F5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Early Access</p>
        <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;line-height:1.2;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">See the market before it happens.</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Share coming-soon listings, off-market inventory, and active buyer demand with verified agents before it goes public.</p>
      </td></tr>
      <tr><td style="padding:8px 0 0;">
        <img src="${heroImg}" alt="All Agent Connect homepage" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px;border:1px solid #94a3b8;" />
      </td></tr>
      <tr><td align="center" style="padding:20px 0 0;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:700;letter-spacing:0.02em;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Elite connections. Proven results.</p>
        <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">The private network for matching buyer needs with off-market inventory.</p>
        <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Exclusive, top-tier networking designed for your success.</p>
      </td></tr>
      ${rowHtml}
      <tr><td style="padding:36px 0 0;border-top:1px solid #e2e8f0;margin-top:32px;">
        <p style="margin:24px 0 4px;font-size:14px;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">More to come soon.</p>
        <p style="margin:0 0 4px;font-size:14px;color:#0f172a;font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
        <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect<br/>617-877-0519 · chris@allagentconnect.com</p>
      </td></tr>
      <tr><td style="padding:24px 0 0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You're receiving this because you registered for early access at allagentconnect.com.</p>
      </td></tr>
    </table>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, message, agentId, agentEmail, sendAsGroup = false, template }: BulkEmailRequest = await req.json();

    const isTemplated = template === "early-access-update-v1" || template === "early-access-update-v2";

    console.log(`[send-bulk-email] Enqueuing bulk email to ${recipients.length} recipients`);

    if (!recipients || recipients.length === 0) {
      throw new Error("No recipients provided");
    }

    if (!subject) {
      throw new Error("Subject is required");
    }
    if (!isTemplated && !message) {
      throw new Error("Message is required");
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

    // Preserve user-inserted HTML (images, links). Otherwise escape and convert newlines.
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const renderedBody = template === "early-access-update-v2"
      ? buildEarlyAccessUpdateV2Body()
      : template === "early-access-update-v1"
        ? buildEarlyAccessUpdateBody()
        : (/<[a-z][\s\S]*>/i.test(message) ? message : escapeHtml(message).replace(/\n/g, "<br>"));

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
            .content img { max-width: 100%; height: auto; }
            .content a { color: #0E56F5; }
          </style>
        </head>
        <body>
          <div class="content">
            {{GREETING}}
            <div>${renderedBody}</div>
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
          .replace("{{GREETING}}", isTemplated ? "" : `<p>Hello ${recipient.name},</p>`) +
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