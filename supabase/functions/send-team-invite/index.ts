import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log("Sending team invite notification to:", agentEmail);

    const contactInfo = [];
    if (teamContactEmail) {
      contactInfo.push(`Email: ${teamContactEmail}`);
    }
    if (teamContactPhone) {
      contactInfo.push(`Phone: ${teamContactPhone}`);
    }
    if (teamOfficeName) {
      contactInfo.push(`Office: ${teamOfficeName}`);
    }
    if (teamOfficeAddress) {
      contactInfo.push(`Address: ${teamOfficeAddress}`);
    }
    if (teamOfficePhone) {
      contactInfo.push(`Office Phone: ${teamOfficePhone}`);
    }
    const contactDetails = contactInfo.length > 0 
      ? contactInfo.join(" | ") 
      : "the team administrator";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "All Agent Connect <onboarding@resend.dev>",
        to: [agentEmail],
        subject: `You've been added to ${teamName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Welcome to ${teamName}!</h1>
            
            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              Hi ${agentName},
            </p>
            
            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              You have been added to <strong>${teamName}</strong> on All Agent Connect.
            </p>
            
            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              You can now view and manage team information, and collaborate with other team members.
            </p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                <strong>If this was done in error, please contact:</strong><br/>
                ${contactDetails}
              </p>
            </div>
            
            <p style="font-size: 14px; color: #999; margin-top: 30px;">
              Best regards,<br/>
              The All Agent Connect Team
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const data = await emailResponse.json();
    console.log("Team invite email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-team-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
