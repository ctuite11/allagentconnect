import "../_shared/migrationRuntime.ts";
// @auth-classification: user-jwt
// Verified network correspondence or publication-scoped DCMLS intake.
import { verifiedPrivacyClient } from "../_shared/privacyAuth.ts";
import { assertMigrationDeliveryAllowed } from "../_shared/migrationSafety.ts";
import { verifyTurnstileToken, TURNSTILE_GENERIC_ERROR } from "../_shared/verifyTurnstile.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AgentProfileContactRequest {
  agentId?: string;
  dcmls?: boolean;
  turnstile_token?: string;
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
    return { allowed: false, remaining: 0, reset_at: new Date(Date.now() + 60000).toISOString(), current_count: limit };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row?.allowed === true ? row : { allowed: false, remaining: 0, reset_at: new Date(Date.now() + 60000).toISOString(), current_count: limit };
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

  if (req.method !== "POST") return new Response(null, { status: 405, headers: corsHeaders });

  try {
    const raw = await req.text();
    if (raw.length > 16384) return new Response(JSON.stringify({ error: "Invalid message" }), { status: 400, headers: corsHeaders });
    const body: AgentProfileContactRequest = JSON.parse(raw);
    const { agentId, dcmls, senderName, senderEmail, senderPhone, message, subject, turnstile_token } = body;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof senderName !== "string" || !senderName.trim() || senderName.length > 100 ||
      typeof senderEmail !== "string" || senderEmail.length > 254 || !emailPattern.test(senderEmail) ||
      (senderPhone != null && (typeof senderPhone !== "string" || senderPhone.length > 32)) ||
      typeof message !== "string" || message.length > 5000 ||
      (subject != null && (typeof subject !== "string" || subject.length > 200 || /[\r\n]/.test(subject))) ||
      (agentId != null && !/^[0-9a-f-]{36}$/i.test(agentId)) || (dcmls != null && typeof dcmls !== "boolean")) {
      return new Response(JSON.stringify({ error: "Invalid message" }), { status: 400, headers: corsHeaders });
    }
    const caller = await verifiedPrivacyClient(req);
    if (!caller && dcmls !== true) return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: corsHeaders });
    assertMigrationDeliveryAllowed();
    if (dcmls === true) {
      if (!agentId) return new Response(JSON.stringify({ error: "Agent is required" }), { status: 400, headers: corsHeaders });
      const check = await verifyTurnstileToken(turnstile_token, req);
      if (!check.ok) return new Response(JSON.stringify({ error: TURNSTILE_GENERIC_ERROR }), { status: 403, headers: corsHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !SERVICE_KEY) return new Response(JSON.stringify({ error: "Server configuration unavailable" }), { status: 503, headers: corsHeaders });
    const admin = createClient(supabaseUrl, SERVICE_KEY);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const actor = dcmls === true ? `dcmls:${agentId}` : `user:${caller!.userId}`;
    for (const [key, limit] of [["global", 120], [actor, 10], [`ip:${ip}`, 20]] as const) {
      const rate = await checkRateLimit(supabaseUrl, SERVICE_KEY, `route:send-agent-profile-contact|${key}`, 60, limit);
      if (!rate.allowed) return build429Response(rate.reset_at);
    }

    let recipient: { email: string; first_name?: string; last_name?: string } | null = null;
    if (dcmls === true) {
      const { data, error } = await admin.rpc("get_dcmls_agent_profile", { p_id_or_code: agentId });
      if (!error) recipient = data;
    } else {
      const { data: isAdmin } = await caller!.client.rpc("has_role", { _user_id: caller!.userId, _role: "admin" });
      let query = caller!.client.from("agent_profiles").select("email,first_name,last_name");
      if (agentId) query = query.eq("id", agentId);
      else if (typeof body.agentEmail === "string" && body.agentEmail.length <= 254 && emailPattern.test(body.agentEmail)) query = query.eq("email", body.agentEmail.trim());
      else return new Response(JSON.stringify({ error: "Agent is required" }), { status: 400, headers: corsHeaders });
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      recipient = data;
      // Administrators retain deliberate outreach to early-access contacts.
      if (!recipient && !agentId && isAdmin === true) recipient = { email: body.agentEmail.trim(), first_name: typeof body.agentName === "string" ? body.agentName.slice(0,100) : "" };
    }
    if (!recipient?.email) return new Response(JSON.stringify({ error: "Agent unavailable" }), { status: 404, headers: corsHeaders });
    const agentEmail = recipient.email;
    const firstName = recipient.first_name || "there";

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
      JSON.stringify({ error: error?.code === "MIGRATION_OUTBOUND_BLOCKED" ? "Delivery is paused" : "Could not queue message" }),
      { status: error?.code === "MIGRATION_OUTBOUND_BLOCKED" ? 503 : 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
