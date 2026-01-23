import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      recipientEmail,
      senderName,
      properties,
      shareLink,
    }: FavoritesShareRequest = await req.json();

    console.log("[send-favorites-share] Enqueuing job for:", recipientEmail);

    const propertiesHtml = properties.map(p => `
      <li style="margin-bottom: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
        <strong>${p.address}</strong><br>
        Price: ${p.price}
        ${p.bedrooms ? ` | ${p.bedrooms} bed` : ''}
        ${p.bathrooms ? ` | ${p.bathrooms} bath` : ''}
      </li>
    `).join('');

    // Enqueue job instead of sending directly
    const { error: insertError } = await supabase
      .from("email_jobs")
      .insert({
        payload: {
          provider: "resend",
          template: "favorites-share",
          to: recipientEmail,
          subject: `${senderName} shared favorite properties with you`,
          variables: {
            senderName,
            shareLink,
            propertiesHtml: `<ul style="list-style: none; padding: 0;">${propertiesHtml}</ul>`,
            propertyCount: properties.length,
          },
        },
      });

    if (insertError) {
      console.error("[send-favorites-share] Failed to enqueue job:", insertError);
      throw insertError;
    }

    console.log("[send-favorites-share] Job enqueued successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Email queued for delivery" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[send-favorites-share] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);