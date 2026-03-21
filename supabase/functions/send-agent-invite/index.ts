import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

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

    const registerUrl = `${PUBLIC_SITE_URL}/register`;

    const html = buildAacEmail({
      headline: `${inviterName} invited you to All Agent Connect`,
      preheader: `${inviterName} thinks you'd be a great fit for All Agent Connect.`,
      body: `
        <p style="margin:0 0 16px;">Hi there,</p>
        <p style="margin:0 0 16px;"><strong>${inviterName}</strong> thinks you'd be a great fit for All Agent Connect.</p>
        <p style="margin:0 0 8px;font-size:14px;color:#334155;">
          <span style="color:#059669;font-weight:600;">✓</span> <strong>By invitation only</strong> — the professional network built by agents, for agents.
        </p>
        <p style="margin:16px 0 0;">Join to connect with buyer agents, share listings, and grow your business.</p>`,
      ctaLabel: "Request Early Access",
      ctaUrl: registerUrl,
    });

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
          html,
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
