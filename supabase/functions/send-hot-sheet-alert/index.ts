import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HotSheetAlertRequest {
  userEmail: string;
  userName: string;
  hotSheetName: string;
  newListings: Array<{
    address: string;
    price: string;
    bedrooms?: number;
    bathrooms?: number;
    listingUrl: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      userEmail,
      userName,
      hotSheetName,
      newListings,
    }: HotSheetAlertRequest = await req.json();

    console.log("Sending hot sheet alert to:", userEmail);

    const listingsList = newListings.map(listing => `
      <li style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
        <strong style="font-size: 16px;">${listing.address}</strong><br>
        <span style="color: #2754C5; font-size: 18px; font-weight: bold;">${listing.price}</span><br>
        ${listing.bedrooms ? `${listing.bedrooms} bed` : ''} 
        ${listing.bathrooms ? `| ${listing.bathrooms} bath` : ''}<br>
        <a href="${listing.listingUrl}" style="color: #2754C5; text-decoration: none;">View Listing →</a>
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
        to: [userEmail],
        subject: `🏠 New listings match your Hot Sheet: ${hotSheetName}`,
        html: `
          <h2>New Properties Match Your Hot Sheet!</h2>
          <p>Hi ${userName},</p>
          <p>We found <strong>${newListings.length}</strong> new ${newListings.length === 1 ? 'listing' : 'listings'} that match your Hot Sheet "<strong>${hotSheetName}</strong>":</p>
          
          <ul style="list-style: none; padding: 0;">
            ${listingsList}
          </ul>
          
          <p style="margin-top: 30px;">
            Don't miss out on these opportunities! Properties that match your criteria can go quickly.
          </p>
          
          <p>Best regards,<br>Your Real Estate Platform</p>
          
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            You're receiving this because you have an active Hot Sheet alert. 
            You can manage your alerts in your account settings.
          </p>
        `,
      }),
    });

    const data = await emailResponse.json();
    console.log("Hot sheet alert sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending hot sheet alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
