import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShowingRequestEmailRequest {
  agentEmail: string;
  agentName: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  listingAddress: string;
  preferredDate: string;
  preferredTime: string;
  message?: string;
  photoUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      agentEmail,
      agentName,
      requesterName,
      requesterEmail,
      requesterPhone,
      listingAddress,
      preferredDate,
      preferredTime,
      message,
      photoUrl,
    }: ShowingRequestEmailRequest = await req.json();

    console.log("Sending showing request email to agent:", agentEmail);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "All Agent Connect <noreply@mail.allagentconnect.com>",
        to: [agentEmail],
        reply_to: requesterEmail,
        subject: `New showing request for ${listingAddress}`,
        html: `
          <h2>New Showing Request</h2>
          <p>Hi ${agentName},</p>
          <p>You have received a new showing request for your listing at <strong>${listingAddress}</strong>.</p>
          
          ${photoUrl ? `
            <div style="margin: 20px 0;">
              <img src="${photoUrl}" alt="${listingAddress}" style="max-width: 100%; height: auto; border-radius: 8px; max-height: 400px; object-fit: cover;" />
            </div>
          ` : ''}
          
          <h3>Requester Details:</h3>
          <ul>
            <li><strong>Name:</strong> ${requesterName}</li>
            <li><strong>Email:</strong> ${requesterEmail}</li>
            ${requesterPhone ? `<li><strong>Phone:</strong> ${requesterPhone}</li>` : ""}
          </ul>
          
          <h3>Showing Details:</h3>
          <ul>
            <li><strong>Preferred Date:</strong> ${preferredDate}</li>
            <li><strong>Preferred Time:</strong> ${preferredTime}</li>
          </ul>
          
          ${message ? `<h3>Additional Message:</h3><p>${message}</p>` : ""}
          
          <p>Please respond to confirm or suggest alternative times by replying to this email or contacting them directly.</p>
          
          <p>Best regards,<br>AAC Worldwide</p>
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
    console.error("Error sending showing request email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
