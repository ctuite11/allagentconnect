// supabase edge function: send-auth-email
// Purpose: Handle Supabase Auth "Send Email Hook" and send emails via Resend
// Requirements:
// - SEND_EMAIL_HOOK_SECRET (from Supabase hook UI)
// - RESEND_API_KEY
// - TRANSACTIONAL_FROM (All Agent Connect <hello@allagentconnect.com>)
// - RESEND_REPLY_TO (hello@allagentconnect.com)

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

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

function mustGetEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function buildEmailForType(params: {
  type: string;
  email: string;
  actionUrl?: string;
  otp?: string;
}): { subject: string; html: string; text: string } {
  const { type, actionUrl, otp } = params;
  const t = (type || "").toLowerCase();

  if (t.includes("recovery") || t.includes("reset")) {
    return {
      subject: "Reset your password",
      html: buildAacEmail({
        headline: "Reset your password",
        body: `<p style="margin:0 0 12px;">We received a request to reset your password. Click below to choose a new one.</p>
               <p style="margin:0;font-size:13px;color:#64748b;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
        ctaLabel: "Reset Password",
        ctaUrl: actionUrl,
      }),
      text: `Reset your password: ${actionUrl ?? ""}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    };
  }

  if (t.includes("signup") || t.includes("confirm")) {
    return {
      subject: "Confirm your email for All Agent Connect",
      html: buildAacEmail({
        headline: "Confirm your email",
        body: `<p style="margin:0;">To finish signing up for All Agent Connect, please confirm your email address. This helps us keep the platform trusted and agent-only.</p>`,
        ctaLabel: "Confirm Email",
        ctaUrl: actionUrl,
      }),
      text: `Confirm your email: ${actionUrl ?? ""}`,
    };
  }

  if (t.includes("magic")) {
    return {
      subject: "Your All Agent Connect sign-in link",
      html: buildAacEmail({
        headline: "Sign in to All Agent Connect",
        body: `<p style="margin:0;">Use the button below to sign in. This link may expire for security.</p>`,
        ctaLabel: "Sign In",
        ctaUrl: actionUrl,
      }),
      text: `Sign in: ${actionUrl ?? ""}`,
    };
  }

  if (t.includes("email_change")) {
    return {
      subject: "Confirm your new email for All Agent Connect",
      html: buildAacEmail({
        headline: "Confirm your new email",
        body: `<p style="margin:0;">Use the button below to confirm your new email address.</p>`,
        ctaLabel: "Confirm New Email",
        ctaUrl: actionUrl,
      }),
      text: `Confirm new email: ${actionUrl ?? ""}`,
    };
  }

  // Fallback
  const bodyText = otp
    ? `Please use the link below to continue. Your one-time code is: ${otp}`
    : "Please use the link below to continue.";
  return {
    subject: "All Agent Connect",
    html: buildAacEmail({
      headline: "Action required",
      body: `<p style="margin:0;">${bodyText}</p>`,
      ctaLabel: actionUrl ? "Continue" : undefined,
      ctaUrl: actionUrl,
    }),
    text: `Continue: ${actionUrl ?? ""}${otp ? `\nOne-time code: ${otp}` : ""}`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const hookSecret = mustGetEnv("SEND_EMAIL_HOOK_SECRET");
    const resendApiKey = mustGetEnv("RESEND_API_KEY");
    const resendReplyTo = mustGetEnv("RESEND_REPLY_TO");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    const rawBody = await req.text();
    const headersObj = Object.fromEntries(req.headers.entries());

    const wh = new Webhook(hookSecret);
    const verified = wh.verify(rawBody, headersObj) as any;

    const email = verified?.user?.email || verified?.email || verified?.recipient;
    const type =
      verified?.email_data?.template?.type ||
      verified?.email_data?.type ||
      verified?.type ||
      verified?.template ||
      "unknown";

    const actionUrl =
      verified?.email_data?.action_link ||
      verified?.email_data?.action_url ||
      verified?.email_data?.redirect_to ||
      verified?.action_link ||
      verified?.action_url ||
      verified?.url;

    const otp =
      verified?.email_data?.otp ||
      verified?.email_data?.token ||
      verified?.otp ||
      verified?.token;

    if (!email) {
      console.error("send-auth-email: Missing recipient email in verified payload", verified);
      return new Response(JSON.stringify({ error: "Missing recipient email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (supabaseUrl && supabaseAnonKey) {
      const rateLimitKey = `route:send-auth-email|email:${email.toLowerCase()}`;
      const rateLimitResult = await checkRateLimit(supabaseUrl, supabaseAnonKey, rateLimitKey, 60, 5);
      
      if (!rateLimitResult.allowed) {
        console.log(`[rate-limit] Blocked email: ${email}, count: ${rateLimitResult.current_count}`);
        return build429Response(rateLimitResult.reset_at);
      }
    }

    console.log("send-auth-email hook invoked:", { type, email, hasActionUrl: !!actionUrl });

    const resend = new Resend(resendApiKey);

    const { subject, html, text } = buildEmailForType({ type, email, actionUrl, otp });

    const from = (Deno.env.get("TRANSACTIONAL_FROM") || "All Agent Connect <hello@allagentconnect.com>");

    const sendRes = await resend.emails.send({
      from,
      to: email,
      reply_to: resendReplyTo,
      subject,
      html,
      text,
    });

    console.log("send-auth-email: Resend response", sendRes);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("send-auth-email error:", err?.message || err, err?.stack);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
