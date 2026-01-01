import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifiedEmailRequest {
  email: string;
  firstName: string;
  foundingPartner: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, foundingPartner }: VerifiedEmailRequest = await req.json();

    console.log(`Sending verified email to: ${email}, foundingPartner: ${foundingPartner}`);

    const foundingPartnerLine = foundingPartner 
      ? `\n\nYou've been granted Founding Partner status as one of the first 250 verified agents. This means free access to the platform at launch and beyond.`
      : '';

    const emailResponse = await resend.emails.send({
      from: "All Agent Connect <hello@mail.allagentconnect.com>",
      to: [email],
      subject: "You're verified — All Agent Connect",
      text: `Hi ${firstName},

Congrats — you're now a verified agent on All Agent Connect.${foundingPartnerLine}

You'll receive access on launch day. We'll send you an email when the platform goes live.

Questions? Reply to this email anytime.

— All Agent Connect
hello@allagentconnect.com`,
    });

    console.log("Verified email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending verified email:", error);
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
