import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RegistrationEmailRequest {
  email: string;
  firstName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName }: RegistrationEmailRequest = await req.json();

    console.log(`Sending registration received email to: ${email}`);

    const emailResponse = await resend.emails.send({
      from: "All Agent Connect <hello@mail.allagentconnect.com>",
      to: [email],
      subject: "All Agent Connect — registration received",
      text: `Hi ${firstName},

Thanks for registering for early access to All Agent Connect.

This platform is for licensed real estate agents only. We verify every license manually to ensure a professional, trusted network.

You'll receive an email as soon as your license is verified and your account is approved.

Be among the first 250 verified agents to receive Founding Partner status — free access to the platform at launch and beyond.

We'll be in touch soon.

— All Agent Connect
hello@allagentconnect.com`,
    });

    console.log("Registration email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending registration email:", error);
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
