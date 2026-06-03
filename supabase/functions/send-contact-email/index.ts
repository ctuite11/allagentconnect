import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  agentEmail: string;
  agentName: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  listingAddress: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  current_count: number;
}

async function checkRateLimit(
  supabaseUrl: string,
  supabaseKey: string,
  key: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.rpc('rate_limit_consume', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (error) {
    console.error("[rate-limit] RPC error:", error);
    return { allowed: true, remaining: limit, reset_at: new Date().toISOString(), current_count: 0 };
  }

  return data as RateLimitResult;
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

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    // Get IP for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown";

    // Database-backed rate limiting: 10 contact emails per minute per IP
    if (supabaseUrl && supabaseAnonKey) {
      const rateLimitKey = `route:send-contact-email|ip:${ip}`;
      const rateLimitResult = await checkRateLimit(supabaseUrl, supabaseAnonKey, rateLimitKey, 60, 10);
      
      if (!rateLimitResult.allowed) {
        console.log(`[rate-limit] Blocked IP: ${ip}, count: ${rateLimitResult.current_count}`);
        return build429Response(rateLimitResult.reset_at);
      }
    }

    const {
      agentEmail,
      agentName,
      senderName,
      senderEmail,
      senderPhone,
      message,
      listingAddress,
    }: ContactEmailRequest = await req.json();

    console.log("Sending contact email to agent:", agentEmail);

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Hi ${escapeHtml(agentName)},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        You received a new message about:
      </p>
      <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#0f172a;">
        ${escapeHtml(listingAddress)}
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
        <tr><td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Contact Details</p>
          <p style="margin:0 0 4px;font-size:15px;color:#334155;"><strong>Name:</strong> ${escapeHtml(senderName)}</p>
          <p style="margin:0 0 0;font-size:15px;color:#334155;"><strong>Email:</strong> ${escapeHtml(senderEmail)}</p>
          ${senderPhone ? `<p style="margin:4px 0 0;font-size:15px;color:#334155;"><strong>Phone:</strong> ${escapeHtml(senderPhone)}</p>` : ""}
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
        <tr><td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(message)}</p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">
        You can reply directly to this email to respond.
      </p>
    `;

    const html = buildAacEmail({
      headline: "New message on your listing",
      body: bodyHtml,
      preheader: `Message about ${listingAddress}`,
    });

    // Transactional-only: strip the "Remove my account" mailto link from the shared
    // dark footer for this email path. The shared template is intentionally not modified.
    const htmlOut = html.replace(
      /<a\s+href="mailto:hello@allagentconnect\.com\?subject=Remove%20My%20Account[^"]*"[^>]*>[\s\S]*?<\/a>/i,
      ""
    );

    const text = [
      `Hi ${agentName},`,
      ``,
      `You received a new message on your listing:`,
      listingAddress,
      ``,
      `Contact Details`,
      `Name:  ${senderName}`,
      `Email: ${senderEmail}`,
      ...(senderPhone ? [`Phone: ${senderPhone}`] : []),
      ``,
      `Message`,
      message,
      ``,
      `You can reply directly to this email.`,
    ].join("\n");

    const { data, error: emailError } = await resend.emails.send({
      from: (Deno.env.get("TRANSACTIONAL_FROM") || "All Agent Connect <hello@notify.allagentconnect.com>"),
      to: [agentEmail],
      replyTo: senderEmail,
      subject: `Message about ${listingAddress}`,
      html: htmlOut,
      text,
    });

    if (emailError) {
      console.error("Resend API error:", emailError);
      throw emailError;
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending contact email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
