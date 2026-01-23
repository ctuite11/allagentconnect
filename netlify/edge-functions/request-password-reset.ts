// Same-origin password reset endpoint with database-backed rate limiting
// Uses Supabase RPC for durable rate limits across cold starts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

interface PasswordResetRequest {
  email: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  current_count: number;
}

async function checkRateLimit(
  supabaseUrl: string,
  supabaseAnonKey: string,
  key: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data, error } = await supabase.rpc('rate_limit_consume', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (error) {
    console.error("[rate-limit] RPC error:", error);
    // Fail open - allow request if rate limiting fails
    return { allowed: true, remaining: limit, reset_at: new Date().toISOString(), current_count: 0 };
  }

  return data as RateLimitResult;
}

function buildLockedEmailHtml(resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;">
          <!-- Header: Plain text only -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <p style="margin:0;font-size:20px;font-weight:600;color:#0F172A;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">AllAgentConnect</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:0 40px 32px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F172A;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Reset your password</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                We received a request to reset your password. Click below to choose a new one.
              </p>
              <!-- Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${resetLink}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#0F172A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
              </p>
              <!-- Fallback: NO <a> tag, code block only -->
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <div style="background-color:#F8FAFC;padding:12px;border-radius:6px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#475569;word-break:break-all;font-family:monospace;">${resetLink}</p>
              </div>
            </td>
          </tr>
          <!-- Footer: Plain text only -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:#64748B;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">AllAgentConnect</p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748B;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">hello@allagentconnect.com</p>
              <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                <a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account%20from%20AllAgentConnect." style="color:#94a3b8;text-decoration:underline;">Click here</a> to request account removal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function build429Response(resetAt: string): Response {
  const resetDate = new Date(resetAt);
  const retryAfter = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 1000));
  
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(resetDate.getTime() / 1000)),
    },
  });
}

export default async function handler(request: Request, context: any) {
  // Only allow POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  // Get client IP
  const clientIP = context.ip || 
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
    "unknown";
  
  // Database-backed rate limiting
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const rateLimitKey = `route:request-password-reset|ip:${clientIP}`;
    const result = await checkRateLimit(SUPABASE_URL, SUPABASE_ANON_KEY, rateLimitKey, 60, 3);
    
    if (!result.allowed) {
      console.log(`[rate-limit] Blocked IP: ${clientIP}, count: ${result.current_count}`);
      // Return 429 with proper headers for rate-limited requests
      return build429Response(result.reset_at);
    }
  }

  try {
    const body: PasswordResetRequest = await request.json();
    const { email } = body;

    // Basic email validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      // Return success anyway to not leak validation info
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Use PUBLIC_SITE_URL env var for redirect, fallback to production domain
    const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://allagentconnect.com";
    const redirectTo = `${publicSiteUrl}/auth/callback`;
    console.log("[request-password-reset] redirectTo =", redirectTo);

    console.log(`Password reset requested for: ${cleanEmail.substring(0, 3)}***`);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      console.error("Missing environment variables:", {
        hasUrl: !!SUPABASE_URL,
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
        hasResend: !!RESEND_API_KEY,
      });
      // Return success to not leak configuration issues
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate recovery link using Supabase Admin API
    const generateLinkResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        type: "recovery",
        email: cleanEmail,
        options: {
          redirect_to: redirectTo,
        },
      }),
    });

    if (!generateLinkResponse.ok) {
      // Log actual error for debugging (not exposed to user)
      const errorBody = await generateLinkResponse.text();
      console.error(
        `[request-password-reset] generate_link failed: status=${generateLinkResponse.status} body=${errorBody.substring(0, 500)}`
      );

      // Keep generic success response (no account enumeration)
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const linkData = await generateLinkResponse.json();
    const resetLink = linkData?.properties?.action_link || linkData?.action_link;
    console.log("[request-password-reset] action_link =", resetLink);
    console.log("[request-password-reset] action_link redirect_to =", resetLink?.split("redirect_to=")[1]?.split("&")[0]);

    if (!resetLink) {
      console.log("No reset link generated - returning success");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Recovery link generated successfully");

    // Send branded email via Resend with locked template
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AllAgentConnect <hello@mail.allagentconnect.com>",
        reply_to: "hello@allagentconnect.com",
        to: [cleanEmail],
        subject: "Reset your password",
        html: buildLockedEmailHtml(resetLink),
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      // Still return success to not leak errors
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Password reset email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    // Always return success to not leak errors
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
