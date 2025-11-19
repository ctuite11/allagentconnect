import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentProfileContactRequest {
  agentEmail: string;
  agentName: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  subject: string;
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
      subject,
    }: AgentProfileContactRequest = await req.json();

    console.log("Sending profile contact email to agent:", agentEmail);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "All Agent Connect <noreply@mail.allagentconnect.com>",
        to: [agentEmail],
        reply_to: senderEmail,
        subject: subject || `New message from ${senderName}`,
        html: `
          <h2>New Message from Your Profile</h2>
          <p>Hi ${agentName},</p>
          <p>You have received a new message through your agent profile.</p>
          
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
    console.log("Profile contact email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending profile contact email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
