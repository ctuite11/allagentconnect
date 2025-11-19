import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HotSheetInviteRequest {
  invitedEmail: string;
  inviterName: string;
  hotSheetName: string;
  hotSheetLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      invitedEmail,
      inviterName,
      hotSheetName,
      hotSheetLink,
    }: HotSheetInviteRequest = await req.json();

    console.log("Sending hot sheet invite to:", invitedEmail);

    const { data, error: emailError } = await resend.emails.send({
      from: "All Agent Connect <noreply@mail.allagentconnect.com>",
      to: [invitedEmail],
      subject: `${inviterName} shared a Hot Sheet with you`,
      html: `
        <h2>You've Been Invited to View a Hot Sheet</h2>
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> has shared their Hot Sheet "<strong>${hotSheetName}</strong>" with you.</p>
        
        <p>Hot Sheets help you track properties that match specific criteria. Click the link below to view the properties:</p>
        
        <p style="margin: 30px 0;">
          <a href="${hotSheetLink}" style="background-color: #2754C5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Hot Sheet
          </a>
        </p>
        
        <p>Best regards,<br>Your Real Estate Platform</p>
      `,
    });

    if (emailError) {
      console.error("Resend API error:", emailError);
      throw emailError;
    }

    console.log("Hot sheet invite sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending hot sheet invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
