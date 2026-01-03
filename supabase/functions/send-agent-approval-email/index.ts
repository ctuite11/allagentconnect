import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApprovalEmailRequest {
  userId: string;
  email?: string;
  firstName?: string;
  approved: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, firstName, approved }: ApprovalEmailRequest = await req.json();

    if (!userId) {
      console.error("No userId provided");
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing ${approved ? 'approval' : 'rejection'} email for user: ${userId}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get agent profile if email/firstName not provided
    let recipientEmail = email;
    let recipientName = firstName;

    if (!recipientEmail || !recipientName) {
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

    // Build approved email HTML - uses subtle AAC green background, logo, and globe visual
    const approvedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Approved</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3FAEE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F3FAEE;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #f1f5f9;" align="center">
              <img src="https://allagentconnect.com/brand/aac-wordmark.png" alt="AllAgentConnect" width="200" style="display: block; max-width: 200px; height: auto;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <!-- Globe icon - represents network access -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 24px auto;">
                <tr>
                  <td align="center">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                      <img src="https://allagentconnect.com/brand/aac-globe.png" alt="" width="48" height="48" style="display: block;" />
                    </div>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                Hi ${recipientName},
              </p>
              
              <p style="font-size: 20px; color: #0f172a; line-height: 1.4; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
                You're officially approved.
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                Your license has been verified and you now have full access to AllAgentConnect — the agent-only network for direct communication and off-market collaboration.
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">
                You can sign in anytime to explore the network, connect with agents, and start collaborating.
              </p>
              
              <!-- CTA Button - AAC accent green, pill shape -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 32px auto;">
                <tr>
                  <td style="background-color: #6FB83F; border-radius: 9999px;">
                    <a href="https://allagentconnect.com/auth" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Enter AllAgentConnect
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0; text-align: center;">
                Welcome to the network,<br>
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
          ? "You're approved — welcome to AllAgentConnect"
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

    // Mark approval email as sent if approved
    if (approved) {
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
