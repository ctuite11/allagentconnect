import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailPayload {
  user: {
    email: string;
    user_metadata?: {
      first_name?: string;
    };
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
  };
}

const getEmailTemplate = (type: string, data: { token?: string; redirectUrl: string; firstName?: string }) => {
  const { token, redirectUrl, firstName } = data;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  
  const baseStyles = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo-text { font-size: 24px; font-weight: 700; color: #1a365d; }
    .logo-accent { color: #2563eb; }
    h1 { color: #1a365d; font-size: 24px; margin: 0 0 20px 0; }
    p { color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .button:hover { background-color: #1d4ed8; }
    .code { background-color: #f3f4f6; padding: 16px 24px; border-radius: 8px; font-family: monospace; font-size: 24px; letter-spacing: 4px; text-align: center; color: #1a365d; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px; }
    .footer a { color: #2563eb; text-decoration: none; }
  `;

  if (type === "magiclink" || type === "signup") {
    return {
      subject: "Log in to AllAgentConnect",
      html: `
        <!DOCTYPE html>
        <html>
        <head><style>${baseStyles}</style></head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <span class="logo-text">All<span class="logo-accent">Agent</span>Connect</span>
              </div>
              <h1>Log in to your account</h1>
              <p>${greeting}</p>
              <p>Click the button below to securely log in to your AllAgentConnect account:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${redirectUrl}" class="button">Log In to AllAgentConnect</a>
              </p>
              ${token ? `
              <p>Or enter this code manually:</p>
              <div class="code">${token}</div>
              ` : ''}
              <p style="color: #9ca3af; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} AllAgentConnect. All rights reserved.</p>
              <p><a href="https://allagentconnect.com">allagentconnect.com</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  if (type === "recovery") {
    return {
      subject: "Reset your AllAgentConnect password",
      html: `
        <!DOCTYPE html>
        <html>
        <head><style>${baseStyles}</style></head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <span class="logo-text">All<span class="logo-accent">Agent</span>Connect</span>
              </div>
              <h1>Reset your password</h1>
              <p>${greeting}</p>
              <p>We received a request to reset the password for your AllAgentConnect account. Click the button below to set a new password:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${redirectUrl}" class="button">Reset Password</a>
              </p>
              ${token ? `
              <p>Or enter this code manually:</p>
              <div class="code">${token}</div>
              ` : ''}
              <p style="color: #9ca3af; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} AllAgentConnect. All rights reserved.</p>
              <p><a href="https://allagentconnect.com">allagentconnect.com</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  if (type === "email_change" || type === "email_change_new") {
    return {
      subject: "Confirm your new email address",
      html: `
        <!DOCTYPE html>
        <html>
        <head><style>${baseStyles}</style></head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <span class="logo-text">All<span class="logo-accent">Agent</span>Connect</span>
              </div>
              <h1>Confirm your new email</h1>
              <p>${greeting}</p>
              <p>Please confirm your new email address by clicking the button below:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${redirectUrl}" class="button">Confirm Email Address</a>
              </p>
              <p style="color: #9ca3af; font-size: 14px;">If you didn't request this change, please contact support immediately.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} AllAgentConnect. All rights reserved.</p>
              <p><a href="https://allagentconnect.com">allagentconnect.com</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  // Default confirmation email
  return {
    subject: "Confirm your AllAgentConnect account",
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="card">
            <div class="logo">
              <span class="logo-text">All<span class="logo-accent">Agent</span>Connect</span>
            </div>
            <h1>Confirm your email</h1>
            <p>${greeting}</p>
            <p>Thank you for signing up! Please confirm your email address by clicking the button below:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${redirectUrl}" class="button">Confirm Email</a>
            </p>
            ${token ? `
            <p>Or enter this code manually:</p>
            <div class="code">${token}</div>
            ` : ''}
            <p style="color: #9ca3af; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} AllAgentConnect. All rights reserved.</p>
            <p><a href="https://allagentconnect.com">allagentconnect.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
};

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-auth-email] Received request");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: AuthEmailPayload = await req.json();
    console.log("[send-auth-email] Payload received:", JSON.stringify({
      email: payload.user?.email,
      email_action_type: payload.email_data?.email_action_type,
    }));

    const { user, email_data } = payload;
    
    if (!user?.email) {
      console.error("[send-auth-email] No email address provided");
      return new Response(
        JSON.stringify({ error: "No email address provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const { token, token_hash, redirect_to, email_action_type } = email_data;
    
    // Build the redirect URL
    let redirectUrl = redirect_to || `${supabaseUrl}/auth/v1/verify`;
    if (token_hash) {
      redirectUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to || ""}`;
    }

    console.log("[send-auth-email] Building email for type:", email_action_type);
    console.log("[send-auth-email] Redirect URL:", redirectUrl);

    const emailTemplate = getEmailTemplate(email_action_type, {
      token,
      redirectUrl,
      firstName: user.user_metadata?.first_name,
    });

    console.log("[send-auth-email] Sending email to:", user.email);
    
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AllAgentConnect <hello@mail.allagentconnect.com>",
        to: [user.email],
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      }),
    });

    const emailResponse = await res.json();
    
    if (!res.ok) {
      console.error("[send-auth-email] Resend error:", emailResponse);
      return new Response(
        JSON.stringify({ error: emailResponse }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-auth-email] Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-auth-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
