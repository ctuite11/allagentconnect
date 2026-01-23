import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userEmail, userName, hotSheetName, newListings }: HotSheetAlertRequest = await req.json();

    console.log("[send-hot-sheet-alert] Enqueuing job for:", userEmail);

    const listingsHtml = newListings.map(listing => `
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

    const { error: insertError } = await supabase.from("email_jobs").insert({
      payload: {
        provider: "resend",
        template: "hot-sheet-alert",
        to: userEmail,
        subject: `🏠 New listings match your Hot Sheet: ${hotSheetName}`,
        variables: {
          userName,
          hotSheetName,
          matchCount: newListings.length,
          listingsHtml: `<ul style="list-style: none; padding: 0;">${listingsHtml}</ul>`,
        },
      },
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-hot-sheet-alert] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);