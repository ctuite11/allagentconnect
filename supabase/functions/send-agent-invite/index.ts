import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";
import { AAC_PUBLIC_URL } from "../_shared/aacPublicUrl.ts";

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

    const registerUrl = `${AAC_PUBLIC_URL}/register`;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const results = [];

    for (const email of inviteeEmails) {
      const { error: enqueueError } = await admin
        .from("email_jobs")
        .insert({
          stream: "transactional",
          payload: {
            provider: "resend",
            template: "agent-invite",
            to: email,
            subject: `${inviterName} invited you to All Agent Connect`,
            html,
          },
        });

      if (enqueueError) {
        console.error(`[send-agent-invite] enqueue failed for ${email}:`, enqueueError);
        results.push({ email, success: false, error: enqueueError.message });
      } else {
        console.log(`[send-agent-invite] enqueued invite to ${email}`);
        results.push({ email, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Completed: ${successCount}/${inviteeEmails.length} invites enqueued successfully`);

    if (successCount > 0) {
      void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }).catch((err) => {
        console.warn("[send-agent-invite] kick-email-queue failed (will run on schedule):", err);
      });
    }

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
