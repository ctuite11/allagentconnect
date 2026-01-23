import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://allagentconnect.lovable.app";
const LOGO_URL = "https://allagentconnect.lovable.app/brand/aac-wordmark.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentInviteRequest {
  inviteeEmails: string[];
  inviterName: string;
  inviterEmail: string;
}

function buildInviteEmailHtml(inviterName: string): string {
  const registerUrl = `${PUBLIC_SITE_URL}/register`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 24px 40px;">
              <img src="${LOGO_URL}" width="64" height="64" alt="AAC" style="display: block; border: 0;" />
              <p style="margin: 16px 0 0 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em;">
                <span style="color: #0E56F5;">All Agent </span><span style="color: #94A3B8;">Connect</span>
              </p>
              <div style="width: 48px; height: 2px; background-color: #0E56F5; margin-top: 16px;"></div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #3f3f46; line-height: 1.6;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #3f3f46; line-height: 1.6;">
                <strong style="color: #18181b;">${inviterName}</strong> thinks you'd be a great fit for All Agent Connect.
              </p>
              
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td style="padding: 0 8px 0 0; vertical-align: top;">
                    <span style="color: #059669; font-size: 16px;">✓</span>
                  </td>
                  <td style="font-size: 14px; color: #52525b; line-height: 1.5;">
                    <strong style="color: #18181b;">By invitation only</strong> — the professional network built by agents, for agents.
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 28px 0; font-size: 15px; color: #3f3f46; line-height: 1.6;">
                Join to connect with buyer agents, share listings, and grow your business.
              </p>
              
              <!-- CTA Button with green dot and arrow -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="background-color: #0F172A; border-radius: 10px;">
                    <a href="${registerUrl}" target="_blank" style="display: inline-block; padding: 14px 24px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="color: #ffffff; font-size: 15px; font-weight: 600; padding-right: 12px;">
                            Request Early Access
                          </td>
                          <td style="vertical-align: middle; padding-right: 6px;">
                            <span style="display: inline-block; width: 8px; height: 8px; background-color: #10B981; border-radius: 50%;"></span>
                          </td>
                          <td style="vertical-align: middle;">
                            <span style="color: #ffffff; font-size: 16px;">→</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Fallback URL -->
              <p style="margin: 28px 0 8px 0; font-size: 13px; color: #71717a;">
                Or copy this link:
              </p>
              <div style="background-color: #F8FAFC; border-radius: 6px; padding: 12px 16px;">
                <code style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 12px; color: #475569; word-break: break-all;">${registerUrl}</code>
              </div>
              
              <!-- Questions -->
              <p style="margin: 28px 0 0 0; font-size: 13px; color: #71717a;">
                Questions? <span style="color: #3f3f46;">hello@allagentconnect.com</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #a1a1aa;">
                AllAgentConnect • hello@allagentconnect.com
              </p>
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                <a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account%20from%20AllAgentConnect." style="color: #a1a1aa; text-decoration: underline;">Click here</a> to request account removal.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inviteeEmails, inviterName, inviterEmail }: AgentInviteRequest = await req.json();

    console.log(`Sending invites from ${inviterName} to ${inviteeEmails.length} recipients`);

    const results = [];
    
    for (const email of inviteeEmails) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "All Agent Connect <hello@mail.allagentconnect.com>",
          to: [email],
          reply_to: inviterEmail,
          subject: `${inviterName} invited you to All Agent Connect`,
          html: buildInviteEmailHtml(inviterName),
        }),
      });

      if (emailResponse.ok) {
        console.log(`Successfully sent invite to ${email}`);
        results.push({ email, success: true });
      } else {
        const errorData = await emailResponse.text();
        console.error(`Failed to send to ${email}:`, errorData);
        results.push({ email, success: false, error: errorData });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Completed: ${successCount}/${inviteeEmails.length} invites sent successfully`);

    return new Response(JSON.stringify({ results, successCount }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-agent-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
