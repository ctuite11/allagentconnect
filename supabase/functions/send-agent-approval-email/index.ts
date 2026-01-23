import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApprovalEmailRequest {
  userId?: string | null;
  email?: string;
  firstName?: string;
  approved: boolean;
  isEarlyAccess?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, firstName, approved, isEarlyAccess }: ApprovalEmailRequest = await req.json();

    // For early access: userId is not required, email and firstName must be provided
    // For real agents: userId is required to look up profile
    if (!isEarlyAccess && !userId) {
      console.error("No userId provided for non-early-access agent");
      return new Response(
        JSON.stringify({ error: "userId is required for real agents" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (isEarlyAccess && !email) {
      console.error("No email provided for early access agent");
      return new Response(
        JSON.stringify({ error: "email is required for early access agents" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing ${approved ? 'approval' : 'rejection'} email for ${isEarlyAccess ? 'early access' : 'real'} agent: ${email || userId}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get agent profile if email/firstName not provided (only for real agents)
    let recipientEmail = email;
    let recipientName = firstName || "Agent";

    if (!isEarlyAccess && (!recipientEmail || !recipientName || recipientName === "Agent")) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("agent_profiles")
        .select("email, first_name")
        .eq("id", userId)
        .maybeSingle();

      if (profileError || !profile?.email) {
        console.error("Error fetching agent profile:", profileError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch agent profile" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      recipientEmail = email || profile.email;
      recipientName = firstName || profile.first_name || "Agent";
    }

    console.log(`Sending ${approved ? 'approval' : 'rejection'} email to ${recipientEmail} (${recipientName})`);

    // Build premium AAC-branded approved email HTML
    const approvedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Approved</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <img src="https://allagentconnect.com/brand/aac-globe.png" 
                   width="80" height="80" alt="AAC" 
                   style="display: block; margin: 0 auto 16px;" />
              <p style="margin: 0; font-size: 22px; font-weight: 600;">
                <span style="color: #0E56F5;">All Agent </span><span style="color: #94A3B8;">Connect</span>
              </p>
              <div style="width: 64px; height: 2px; background: #0E56F5; margin: 12px auto 0;"></div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 8px 40px 40px;">
              <p style="font-size: 16px; color: #334155; line-height: 1.7; margin: 0 0 20px 0;">
                Hi ${recipientName},
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.7; margin: 0 0 8px 0;">
                <span style="color: #059669; font-weight: 600;">✓</span> Your license has been verified
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.7; margin: 0 0 28px 0;">
                Your AllAgentConnect access is now active.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center" style="background-color: #0F172A; border-radius: 8px;">
                    <a href="https://allagentconnect.com/auth" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
                      Sign In
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Fallback URL -->
              <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">
                Or visit:
              </p>
              <div style="background-color: #F8FAFC; padding: 12px; border-radius: 6px; margin: 0 0 28px 0;">
                <p style="margin: 0; font-size: 12px; color: #475569; word-break: break-all; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
                  https://allagentconnect.com/auth
                </p>
              </div>
              
              <p style="font-size: 15px; color: #64748b; line-height: 1.7; margin: 0;">
                Questions? <a href="mailto:hello@allagentconnect.com" style="color: #334155; text-decoration: none;">hello@allagentconnect.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #f1f5f9;">
              <p style="font-size: 13px; color: #94a3b8; margin: 0 0 8px 0; text-align: center;">
                AllAgentConnect &nbsp;•&nbsp; hello@allagentconnect.com
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">
                <a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account%20from%20AllAgentConnect." style="color: #94a3b8; text-decoration: underline;">Click here</a> to request account removal.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Build rejected email HTML
    const rejectedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 600; color: #0f172a;">AllAgent</span><span style="font-size: 20px; font-weight: 600; color: #94a3b8;">Connect</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${recipientName},
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for your interest in AllAgentConnect.
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Unfortunately, we were unable to verify your real estate license with the information provided. This could be due to:
              </p>
              
              <ul style="margin: 0 0 24px 20px; padding: 0; color: #64748b; font-size: 16px; line-height: 1.8;">
                <li>License number not found in state database</li>
                <li>Name mismatch with license records</li>
                <li>License may be expired or inactive</li>
              </ul>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 32px 0;">
                If you believe this was an error, please reply to this email with your correct license information and we'll be happy to take another look.
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0;">
                <span style="color: #64748b;">— AllAgentConnect Team</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f1f5f9; background-color: #fafafa; border-radius: 0 0 16px 16px;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} AllAgentConnect. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email via Resend API
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AllAgentConnect <hello@mail.allagentconnect.com>",
        reply_to: "hello@allagentconnect.com",
        to: [recipientEmail],
        subject: approved 
          ? "Your AllAgentConnect access is active"
          : "AllAgentConnect - Verification Update",
        html: approved ? approvedHtml : rejectedHtml,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend API error:", emailData);
      throw new Error(emailData.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailData);

    // Mark approval email as sent if approved (only for real agents with userId)
    if (approved && userId && !isEarlyAccess) {
      const { error: updateError } = await supabaseAdmin
        .from("agent_settings")
        .update({ approval_email_sent: true })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Warning: Failed to update approval_email_sent flag:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-agent-approval-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
