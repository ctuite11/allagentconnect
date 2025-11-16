import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FavoritesShareRequest {
  recipientEmail: string;
  senderName: string;
  properties: Array<{
    address: string;
    price: string;
    bedrooms?: number;
    bathrooms?: number;
  }>;
  shareLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      recipientEmail,
      senderName,
      properties,
      shareLink,
    }: FavoritesShareRequest = await req.json();

    console.log("Sending favorites share to:", recipientEmail);

    const propertiesList = properties.map(p => `
      <li style="margin-bottom: 15px;">
        <strong>${p.address}</strong><br>
        Price: ${p.price}
        ${p.bedrooms ? `| ${p.bedrooms} bed` : ''}
        ${p.bathrooms ? `| ${p.bathrooms} bath` : ''}
      </li>
    `).join('');

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AAC Worldwide <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: `${senderName} shared favorite properties with you`,
        html: `
          <h2>Someone Shared Their Favorite Properties</h2>
          <p>Hi there,</p>
          <p><strong>${senderName}</strong> wants to share some properties they've been looking at:</p>
          
          <ul style="list-style: none; padding: 0;">
            ${propertiesList}
          </ul>
          
          <p style="margin: 30px 0;">
            <a href="${shareLink}" style="background-color: #2754C5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View All Properties
            </a>
          </p>
          
          <p>Best regards,<br>Your Real Estate Platform</p>
        `,
      }),
    });

    const data = await emailResponse.json();
    console.log("Favorites share sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending favorites share:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
