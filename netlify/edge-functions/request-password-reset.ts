// Same-origin password reset endpoint - no CORS issues
// Rate limiting via simple in-memory store (resets on deploy)

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = ipRequestCounts.get(ip);
  
  if (!record || now > record.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  record.count++;
  return false;
}

interface PasswordResetRequest {
  email: string;
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
              <p style="margin:0;font-size:13px;line-height:1.5;color:#64748B;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">mail.allagentconnect.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(request: Request, context: any) {
  // Only allow POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientIP = context.ip || request.headers.get("x-forwarded-for") || "unknown";
  
  // Rate limiting
  if (isRateLimited(clientIP)) {
    console.log(`Rate limited IP: ${clientIP}`);
    // Still return success to not leak information
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
    
    // Redirect to auth/callback which handles the recovery token and routes to password-reset
    const redirectTo = "https://allagentconnect.com/auth/callback";
    console.log("[request-password-reset] redirectTo =", redirectTo);

    console.log(`Password reset requested for: ${cleanEmail.substring(0, 3)}***`);

    // Get secrets from Netlify environment
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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
