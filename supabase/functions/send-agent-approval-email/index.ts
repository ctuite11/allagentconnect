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
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId }: ApprovalEmailRequest = await req.json();

    if (!userId) {
      console.error("No userId provided");
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing approval email for user: ${userId}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if approval email was already sent (duplicate protection)
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("agent_settings")
      .select("approval_email_sent, agent_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching agent settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch agent settings" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Guard: Only send if not already sent AND status is verified
    if (settings?.approval_email_sent) {
      console.log(`Approval email already sent for user ${userId}, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "already_sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (settings?.agent_status !== "verified") {
      console.log(`Agent ${userId} is not verified (status: ${settings?.agent_status}), skipping email`);
      return new Response(
        JSON.stringify({ success: false, reason: "not_verified" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get agent profile for personalization
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

    const firstName = profile.first_name || "Agent";
    const recipientEmail = profile.email;

    console.log(`Sending approval email to ${recipientEmail} (${firstName})`);

    // Build email HTML
    const emailHtml = `
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
              <!-- Check icon -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #ecfdf5; border-radius: 50%; width: 48px; height: 48px; text-align: center; vertical-align: middle;">
                    <span style="color: #10b981; font-size: 24px;">✓</span>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${firstName},
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0; font-weight: 600;">
                You're officially approved.
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Your license has been verified and you now have full access to AllAgentConnect — the agent-only network for direct communication and off-market collaboration.
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 32px 0;">
                You can sign in anytime to explore the network, connect with agents, and start collaborating.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 32px 0;">
                <tr>
                  <td style="background-color: #10b981; border-radius: 8px;">
                    <a href="https://allagentconnect.com/auth" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Enter AllAgentConnect
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0;">
                Welcome in,<br>
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
        subject: "You're approved — welcome to AllAgentConnect",
        html: emailHtml,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend API error:", emailData);
      throw new Error(emailData.message || "Failed to send approval email");
    }

    console.log("Approval email sent successfully:", emailData);

    // Mark email as sent (duplicate protection)
    const { error: updateError } = await supabaseAdmin
      .from("agent_settings")
      .update({ approval_email_sent: true })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Warning: Failed to update approval_email_sent flag:", updateError);
      // Don't fail the request, email was sent successfully
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
