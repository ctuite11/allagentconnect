import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://allagentconnect.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentInviteRequest {
  inviteeEmails: string[];
  inviterName: string;
  inviterEmail: string;
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
          from: "All Agent Connect <noreply@mail.allagentconnect.com>",
          to: [email],
          reply_to: inviterEmail,
          subject: `${inviterName} invited you to All Agent Connect`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #18181b; font-size: 24px; margin-bottom: 20px;">You've been invited!</h1>
              
              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6; margin-bottom: 16px;">
                <strong>${inviterName}</strong> thinks you'd be a great fit for All Agent Connect — 
                the professional network built by agents, for agents.
              </p>
              
              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6; margin-bottom: 24px;">
                Join the network to connect with buyer agents, share listings, 
                and grow your business.
              </p>
              
              <div style="margin: 30px 0;">
                <a href="${PUBLIC_SITE_URL}/register" 
                   style="background-color: #18181b; color: white; padding: 14px 28px; 
                          text-decoration: none; border-radius: 8px; font-weight: 600;
                          display: inline-block;">
                  Request Early Access
                </a>
              </div>
              
              <p style="font-size: 14px; color: #71717a; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e4e4e7;">
                Best regards,<br/>
                The All Agent Connect Team
              </p>
            </div>
          `,
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
