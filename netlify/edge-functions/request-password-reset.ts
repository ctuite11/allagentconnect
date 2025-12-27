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
  redirectUrl?: string;
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
    const { email, redirectUrl } = body;

    // Basic email validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      // Return success anyway to not leak validation info
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const finalRedirectUrl = redirectUrl || `${new URL(request.url).origin}/password-reset`;

    console.log(`Password reset requested for: ${cleanEmail.substring(0, 3)}***`);

    // Get secrets from Netlify environment
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
          redirect_to: finalRedirectUrl,
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
    const resetLink = linkData.action_link;

    if (!resetLink) {
      console.log("No reset link generated - returning success");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Recovery link generated successfully");

    // Send branded email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "All Agent Connect <noreply@mail.allagentconnect.com>",
        to: [cleanEmail],
        subject: "Reset Your Password - All Agent Connect",
        html: `
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
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px 30px;
                text-align: center;
              }
              .header h1 {
                color: #ffffff;
                margin: 0;
                font-size: 28px;
                font-weight: 600;
              }
              .content {
                padding: 40px 30px;
              }
              .content h2 {
                color: #333;
                font-size: 22px;
                margin-top: 0;
                margin-bottom: 20px;
              }
              .content p {
                color: #666;
                font-size: 16px;
                margin-bottom: 20px;
              }
              .button-container {
                text-align: center;
                margin: 30px 0;
              }
              .button {
                display: inline-block;
                padding: 14px 32px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;
              }
              .divider {
                border-top: 1px solid #e0e0e0;
                margin: 30px 0;
              }
              .link-text {
                color: #666;
                font-size: 14px;
                word-break: break-all;
              }
              .footer {
                background-color: #f8f8f8;
                padding: 30px;
                text-align: center;
                color: #999;
                font-size: 14px;
              }
              .footer a {
                color: #667eea;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>All Agent Connect</h1>
              </div>
              
              <div class="content">
                <h2>Reset Your Password</h2>
                <p>We received a request to reset the password for your All Agent Connect account.</p>
                <p>Click the button below to choose a new password:</p>
                
                <div class="button-container">
                  <a href="${resetLink}" class="button">Reset Password</a>
                </div>
                
                <p>This link will expire in 1 hour for security reasons.</p>
                
                <div class="divider"></div>
                
                <p style="font-size: 14px; color: #666;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p class="link-text">${resetLink}</p>
                
                <div class="divider"></div>
                
                <p style="font-size: 14px; color: #999;">
                  <strong>Didn't request this?</strong><br>
                  If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
              </div>
              
              <div class="footer">
                <p>
                  <strong>All Agent Connect</strong><br>
                  Revolutionizing Real Estate Through Complete Transparency
                </p>
                <p>
                  Need help? <a href="mailto:support@allagentconnect.com">Contact Support</a>
                </p>
              </div>
            </div>
          </body>
        </html>
        `,
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
