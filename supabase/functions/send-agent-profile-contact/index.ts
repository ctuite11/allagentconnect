import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentProfileContactRequest {
  agentEmail: string;
  agentName: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  subject: string;
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

function esc(s: string): string {
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
      const rateLimitKey = `route:send-agent-profile-contact|ip:${ip}`;
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
      subject,
    }: AgentProfileContactRequest = await req.json();

    console.log("Sending profile contact email to agent:", agentEmail);

    const firstName = (agentName || "").split(" ")[0] || "there";

    const bodyHtml = `
      <p style="margin:0 0 12px;color:#334155;">Hi ${esc(firstName)},</p>
      <p style="margin:0 0 20px;color:#334155;">You received a new message through your All Agent Connect network.</p>
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Contact Details</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;font-size:14px;line-height:1.6;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#0f172a;">Name</td><td style="padding:4px 0;color:#334155;">${esc(senderName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#0f172a;">Email</td><td style="padding:4px 0;color:#334155;">${esc(senderEmail)}</td></tr>
        ${senderPhone ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#0f172a;">Phone</td><td style="padding:4px 0;color:#334155;">${esc(senderPhone)}</td></tr>` : ""}
      </table>
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
      <div style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 20px;">
        <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(message || "")}</p>
      </div>
      
    `;

    const html = buildAacEmail({
      headline: "New message from your network",
      body: bodyHtml,
      preheader: `${senderName} sent you a message on All Agent Connect`,
    });

    const text = [
      `Hi ${firstName},`,
      ``,
      `You received a new message through your All Agent Connect profile.`,
      ``,
      `Contact Details`,
      `Name:  ${senderName}`,
      `Email: ${senderEmail}`,
      ...(senderPhone ? [`Phone: ${senderPhone}`] : []),
      ``,
      `Message`,
      message || "",
      ``,
      `Reply directly to ${senderEmail} to respond.`,
    ].join("\n");

    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !SERVICE_KEY) {
      console.error("[send-agent-profile-contact] Missing Supabase env");
      return new Response(JSON.stringify({ error: "config" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(supabaseUrl, SERVICE_KEY);
    const finalSubject = subject || `${senderName} sent you a message on All Agent Connect`;

    const { data: job, error: insertErr } = await admin
      .from("email_jobs")
      .insert({
        payload: {
          provider: "resend",
          template: "agent-profile-contact",
          to: agentEmail,
          subject: finalSubject,
          html,
          text,
        },
      })
      .select("id")
      .single();

    if (insertErr || !job) {
      console.error("[send-agent-profile-contact] enqueue failed:", insertErr);
      return new Response(JSON.stringify({ error: "enqueue_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Kick the queue (best-effort)
    try {
      await fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({}),
      });
    } catch (kickErr) {
      console.warn("[send-agent-profile-contact] kick-email-queue failed (non-fatal):", kickErr);
    }

    console.log("Profile contact email enqueued:", job.id);

    return new Response(JSON.stringify({ success: true, enqueued: true, jobId: job.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending profile contact email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
