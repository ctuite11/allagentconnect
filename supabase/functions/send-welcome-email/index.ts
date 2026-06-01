import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  firstName: string;
  lastName: string;
}

const getFrontendUrl = (): string => {
  return Deno.env.get("FRONTEND_URL") || "https://allagentconnect.com";
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName }: WelcomeEmailRequest = await req.json();
    console.log("Sending welcome email to:", email);

    const fullName = `${firstName} ${lastName}`;
    const frontendUrl = getFrontendUrl();

    const html = buildAacEmail({
      headline: "Welcome to All Agent Connect",
      preheader: `Welcome, ${firstName}! Your account is ready.`,
      body: `
        <p style="margin:0 0 16px;">Hi ${fullName},</p>
        <p style="margin:0 0 16px;">Thank you for joining All Agent Connect. Your account is set up and ready to go.</p>
        <p style="margin:0;">Browse the agent network, manage your listings, and connect with verified agents in your market.</p>`,
      ctaLabel: "Get Started",
      ctaUrl: `${frontendUrl}/browse`,
    });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: (Deno.env.get("TRANSACTIONAL_FROM") || "All Agent Connect <hello@mail.allagentconnect.com>"),
        to: [email],
        subject: "Welcome to All Agent Connect",
        html,
      }),
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
