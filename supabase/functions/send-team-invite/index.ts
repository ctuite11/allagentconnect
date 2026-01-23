import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamInviteRequest {
  agentEmail: string;
  agentName: string;
  teamName: string;
  teamContactEmail?: string;
  teamContactPhone?: string;
  teamOfficeName?: string;
  teamOfficeAddress?: string;
  teamOfficePhone?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      agentEmail, 
      agentName, 
      teamName,
      teamContactEmail,
      teamContactPhone,
      teamOfficeName,
      teamOfficeAddress,
      teamOfficePhone
    }: TeamInviteRequest = await req.json();

    console.log("[send-team-invite] Enqueuing job for:", agentEmail);

    const contactInfo = [];
    if (teamContactEmail) contactInfo.push(`Email: ${teamContactEmail}`);
    if (teamContactPhone) contactInfo.push(`Phone: ${teamContactPhone}`);
    if (teamOfficeName) contactInfo.push(`Office: ${teamOfficeName}`);
    if (teamOfficeAddress) contactInfo.push(`Address: ${teamOfficeAddress}`);
    if (teamOfficePhone) contactInfo.push(`Office Phone: ${teamOfficePhone}`);
    const contactDetails = contactInfo.length > 0 ? contactInfo.join(" | ") : "the team administrator";

    const { error: insertError } = await supabase.from("email_jobs").insert({
      payload: {
        provider: "resend",
        template: "team-invite",
        to: agentEmail,
        subject: `You've been added to ${teamName}`,
        variables: {
          agentName,
          teamName,
          contactDetails,
          contentHtml: `
            <h1>Welcome to ${teamName}!</h1>
            <p>Hi ${agentName},</p>
            <p>You have been added to <strong>${teamName}</strong> on All Agent Connect.</p>
            <p>You can now view and manage team information, and collaborate with other team members.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>If this was done in error, please contact:</strong><br/>${contactDetails}</p>
            </div>
            <p>Best regards,<br/>The All Agent Connect Team</p>
          `,
        },
      },
    });

    if (insertError) {
      console.error("[send-team-invite] Failed to enqueue:", insertError);
      throw new Error("Failed to queue email");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email queued" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-team-invite] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);