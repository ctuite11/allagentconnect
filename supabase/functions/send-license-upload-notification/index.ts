import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "chris@allagentconnect.com";
const ADMIN_PANEL_URL = "https://allagentconnect.com/admin/approvals";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get agent name
    const { data: profile } = await supabaseAdmin
      .from("agent_profiles")
      .select("first_name, last_name, email")
      .eq("id", userId)
      .maybeSingle();

    const agentName = profile
      ? `${profile.first_name} ${profile.last_name}`
      : "Unknown Agent";
    const agentEmail = profile?.email || "N/A";

    console.log(`Sending license upload notification for ${agentName} (${agentEmail})`);

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);border:1px solid #e2e8f0;">
          <tr>
            <td align="center" style="padding:32px 40px 24px;">
              <img src="https://allagentconnect.com/brand/aac-globe.png" width="80" height="80" alt="AAC" style="display:block;margin:0 auto 16px;" />
              <p style="margin:0;font-size:22px;font-weight:600;">
                <span style="color:#0E56F5;">All Agent </span><span style="color:#94A3B8;">Connect</span>
              </p>
              <div style="width:64px;height:2px;background:#0E56F5;margin:12px auto 0;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 40px;">
              <p style="font-size:16px;color:#334155;line-height:1.7;margin:0 0 20px;">
                A rejected agent has uploaded their license for manual review.
              </p>
              <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:0 0 24px;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-weight:500;">Agent:</td>
                    <td style="padding:6px 0;color:#0f172a;font-weight:600;">${agentName}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-weight:500;">Email:</td>
                    <td style="padding:6px 0;color:#0f172a;">${agentEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-weight:500;">Submitted:</td>
                    <td style="padding:6px 0;color:#0f172a;">${new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" })} EST</td>
                  </tr>
                </table>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                <tr>
                  <td align="center" style="background-color:#0F172A;border-radius:10px;">
                    <a href="${ADMIN_PANEL_URL}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                      <span style="color:#10B981;">●</span>&nbsp;&nbsp;Review in Admin Panel&nbsp;&nbsp;→
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f1f5f9;">
              <p style="font-size:13px;color:#94a3b8;margin:0;text-align:center;">
                AllAgentConnect Admin Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AllAgentConnect <hello@mail.allagentconnect.com>",
        reply_to: "hello@allagentconnect.com",
        to: [ADMIN_EMAIL],
        subject: `📎 License Uploaded — ${agentName}`,
        html,
      }),
    });

    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      console.error("Resend error:", emailData);
      throw new Error(emailData.message || "Failed to send notification");
    }

    console.log("Admin notification sent:", emailData);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
