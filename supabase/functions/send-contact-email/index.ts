import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  agentEmail: string;
  agentName: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  listingAddress: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      agentEmail,
      agentName,
      senderName,
      senderEmail,
      senderPhone,
      message,
      listingAddress,
    }: ContactEmailRequest = await req.json();

    console.log("Sending contact email to agent:", agentEmail);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AAC Worldwide <noreply@allagentconnect.com>",
        to: [agentEmail],
        reply_to: senderEmail,
        subject: `New inquiry about ${listingAddress}`,
        html: `
          <h2>New Contact Message</h2>
          <p>Hi ${agentName},</p>
          <p>You have received a new message about your listing at <strong>${listingAddress}</strong>.</p>
          
          <h3>Contact Details:</h3>
          <ul>
            <li><strong>Name:</strong> ${senderName}</li>
            <li><strong>Email:</strong> ${senderEmail}</li>
            ${senderPhone ? `<li><strong>Phone:</strong> ${senderPhone}</li>` : ""}
          </ul>
          
          <h3>Message:</h3>
          <p>${message}</p>
          
          <p>Please respond to this inquiry at your earliest convenience by replying to this email or contacting them directly.</p>
          
          <p>Best regards,<br>Your Real Estate Platform</p>
        `,
      }),
    });

    const data = await emailResponse.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending contact email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
