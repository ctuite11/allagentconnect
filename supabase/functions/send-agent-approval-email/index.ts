import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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

    let passwordSetupUrl = "https://allagentconnect.com/auth";

    if (approved && recipientEmail) {
      try {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: recipientEmail,
          options: {
            redirectTo: "https://allagentconnect.com/auth/callback",
          },
        });

        if (linkError) {
          console.error("Error generating recovery link:", linkError);
        } else if (linkData?.properties?.action_link) {
          passwordSetupUrl = linkData.properties.action_link;
          console.log("Generated password setup link for", recipientEmail);
        }
      } catch (linkErr) {
        console.error("Failed to generate recovery link:", linkErr);
      }
    }

    const html = approved
      ? buildAacEmail({
          headline: "You've Been Accepted",
          preheader: `Welcome to All Agent Connect, ${recipientName}!`,
          body: `
            <p style="margin:0 0 16px;">Hi ${recipientName},</p>
            <p style="margin:0 0 8px;font-size:15px;">
              <span style="color:#059669;font-weight:600;">✓</span> Your license has been verified
            </p>
            <p style="margin:0 0 0;">You've been accepted into All Agent Connect. Sign in below to access your agent dashboard.</p>`,
          ctaLabel: "Sign In to Your Account",
          ctaUrl: passwordSetupUrl,
        })
      : buildAacEmail({
          headline: "Verification Update",
          body: `
            <p style="margin:0 0 16px;">Hi ${recipientName},</p>
            <p style="margin:0 0 16px;">Thank you for your interest in All Agent Connect. Unfortunately, we were unable to verify your real estate license with the information provided. This could be due to:</p>
            <ul style="margin:0 0 16px 20px;padding:0;color:#64748b;font-size:14px;line-height:2;">
              <li>License number not found in state database</li>
              <li>Name mismatch with license records</li>
              <li>License may be expired or inactive</li>
            </ul>
            <p style="margin:0;">You can upload a photo or PDF of your license and we'll review it manually.</p>`,
          ctaLabel: "Upload Your License",
          ctaUrl: "https://allagentconnect.com/pending-verification",
        });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: (Deno.env.get("TRANSACTIONAL_FROM") || "All Agent Connect <hello@allagentconnect.com>"),
        reply_to: "hello@allagentconnect.com",
        to: [recipientEmail],
        subject: approved 
          ? "You've Been Accepted — Sign In to Your Account"
          : "All Agent Connect - Verification Update",
        html,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend API error:", emailData);
      throw new Error(emailData.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailData);

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
