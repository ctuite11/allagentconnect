import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    const { data, error: emailError } = await resend.emails.send({
      from: "All Agent Connect <noreply@mail.allagentconnect.com>",
      to: [agentEmail],
      replyTo: senderEmail,
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
    });

    if (emailError) {
      console.error("Resend API error:", emailError);
      throw emailError;
    }

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
