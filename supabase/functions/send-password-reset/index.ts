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

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "All Agent Connect <noreply@mail.allagentconnect.com>",
        to: [email],
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
                transition: transform 0.2s;
              }
              .button:hover {
                transform: translateY(-2px);
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
