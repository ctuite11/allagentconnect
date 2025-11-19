import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    photoUrl?: string;
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
      <li style="margin-bottom: 20px; padding: 0; background-color: #f9f9f9; border-radius: 5px; overflow: hidden;">
        ${listing.photoUrl ? `<img src="${listing.photoUrl}" alt="${listing.address}" style="width: 100%; height: 200px; object-fit: cover;" />` : ''}
        <div style="padding: 15px;">
          <strong style="font-size: 16px;">${listing.address}</strong><br>
          <span style="color: #2754C5; font-size: 18px; font-weight: bold;">${listing.price}</span><br>
          ${listing.bedrooms ? `${listing.bedrooms} bed` : ''} 
          ${listing.bathrooms ? `| ${listing.bathrooms} bath` : ''}<br>
          <a href="${listing.listingUrl}" style="color: #2754C5; text-decoration: none; display: inline-block; margin-top: 10px;">View Listing →</a>
        </div>
      </li>
    `).join('');

    const { data, error: emailError } = await resend.emails.send({
      from: "All Agent Connect <noreply@mail.allagentconnect.com>",
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
    });

    if (emailError) {
      console.error("Resend API error:", emailError);
      throw emailError;
    }

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
