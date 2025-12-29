import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  redirectUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log(`[send-password-reset] ${req.method} request from ${req.headers.get("origin") || "unknown"}`);
  
  // Handle CORS preflight requests - null body for proper 200 response
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectUrl }: PasswordResetRequest = await req.json();

    console.log("Processing password reset request for:", email);
    console.log("Redirect URL:", redirectUrl);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY");
    }

    // Create admin client to generate recovery link
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate recovery link using admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    // Security best practice: Don't reveal if email exists or not
    // Always return success to prevent user enumeration attacks
    if (linkError) {
      console.error("[send-password-reset] generateLink failed:", {
        code: linkError.code,
        message: linkError.message,
        status: linkError.status,
      });
      console.log("[send-password-reset] Returning success anyway for security (no user enumeration)");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    if (!linkData?.properties?.action_link) {
      console.log("No action link generated - returning success anyway for security");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const resetLink = linkData.properties.action_link;
    console.log("Recovery link generated successfully");

    // Send email via Resend with premium AAC template
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AllAgentConnect <hello@mail.allagentconnect.com>",
        reply_to: "hello@allagentconnect.com",
        to: [email],
        subject: "Reset Your Password",
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid #e2e8f0;">
              <h1 style="margin:0;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.02em;">AllAgentConnect</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#0f172a;">Reset Your Password</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                We received a request to reset your password. Click below to choose a new one.
              </p>
              <!-- Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${resetLink}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#1e293b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:6px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">
                This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
              </p>
              <!-- Fallback link -->
              <p style="margin:0;font-size:13px;color:#94a3b8;">
                Link not working? Copy and paste this URL into your browser:
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">
                ${resetLink}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:13px;color:#94a3b8;">
                mail.allagentconnect.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(errorData.message || "Failed to send email");
    }

    const emailResult = await emailResponse.json();
    console.log("Password reset email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
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
