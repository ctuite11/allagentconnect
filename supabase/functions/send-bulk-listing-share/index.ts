import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkShareRequest {
  listingIds: string[];
  recipientName: string;
  recipientEmail: string;
  agentName: string;
  agentEmail: string;
  agentPhone?: string;
  message?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  current_count: number;
}

async function checkRateLimit(
  supabase: any,
  key: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('rate_limit_consume', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (error) {
    console.error("[rate-limit] RPC error:", error);
    return { allowed: true, remaining: limit, reset_at: new Date().toISOString(), current_count: 0 };
  }

  return data as RateLimitResult;
}

function build429Response(resetAt: string): Response {
  const resetDate = new Date(resetAt);
  const retryAfter = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 1000));
  
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(resetDate.getTime() / 1000)),
    },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get IP for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown";

    // Database-backed rate limiting: 5 bulk shares per minute per IP
    const rateLimitKey = `route:send-bulk-listing-share|ip:${ip}`;
    const rateLimitResult = await checkRateLimit(supabase, rateLimitKey, 60, 5);
    
    if (!rateLimitResult.allowed) {
      console.log(`[rate-limit] Blocked IP: ${ip}, count: ${rateLimitResult.current_count}`);
      return build429Response(rateLimitResult.reset_at);
    }

    const {
      listingIds,
      recipientName,
      recipientEmail,
      agentName,
      agentEmail,
      agentPhone,
      message,
    }: BulkShareRequest = await req.json();

    console.log(`[send-bulk-listing-share] Enqueuing ${listingIds.length} listings to ${recipientEmail}`);

    // Fetch all listings
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("*")
      .in("id", listingIds);

    if (listingsError || !listings || listings.length === 0) {
      console.error("[send-bulk-listing-share] Error fetching listings:", listingsError);
      throw new Error("Failed to fetch listings");
    }

    // Build listings HTML
    const listingsHtml = listings.map((listing) => {
      const photos = listing.photos || [];
      const firstPhoto = photos[0]?.url || photos[0] || "";

      return `
        <div style="margin-bottom: 30px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: white;">
          ${firstPhoto ? `
            <img src="${firstPhoto}" alt="${listing.address}" style="width: 100%; height: 250px; object-fit: cover;" />
          ` : ''}
          <div style="padding: 20px;">
            <h3 style="margin: 0 0 10px 0; font-size: 24px; color: #1a1a1a;">$${listing.price.toLocaleString()}</h3>
            <p style="margin: 0 0 10px 0; font-size: 16px; color: #333;">${listing.address}</p>
            <p style="margin: 0 0 10px 0; color: #666;">${listing.city}, ${listing.state} ${listing.zip_code}</p>
            <div style="display: flex; gap: 20px; margin-top: 15px; color: #666;">
              ${listing.bedrooms ? `<span>🛏️ ${listing.bedrooms} bed${listing.bedrooms > 1 ? 's' : ''}</span>` : ''}
              ${listing.bathrooms ? `<span>🚿 ${listing.bathrooms} bath${listing.bathrooms > 1 ? 's' : ''}</span>` : ''}
              ${listing.square_feet ? `<span>📐 ${listing.square_feet.toLocaleString()} sq ft</span>` : ''}
            </div>
            ${listing.property_type ? `<p style="margin: 10px 0 0 0; color: #666;">${listing.property_type}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <div style="background-color: #1a1a1a; color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">New Property Listings</h1>
            </div>
            
            <div style="padding: 30px;">
              <p style="font-size: 16px; line-height: 1.6; color: #333;">Hi ${recipientName},</p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                ${agentName} wanted to share ${listings.length} property listing${listings.length > 1 ? 's' : ''} with you that might interest you:
              </p>

              ${message ? `
                <div style="background-color: #f9f9f9; border-left: 4px solid #1a1a1a; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; color: #333; font-style: italic;">"${message}"</p>
                </div>
              ` : ''}

              <div style="margin: 30px 0;">
                ${listingsHtml}
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="font-size: 16px; color: #333; margin-bottom: 10px;"><strong>Contact Information:</strong></p>
                <p style="margin: 5px 0; color: #666;">${agentName}</p>
                <p style="margin: 5px 0; color: #666;">📧 <a href="mailto:${agentEmail}" style="color: #1a1a1a;">${agentEmail}</a></p>
                ${agentPhone ? `<p style="margin: 5px 0; color: #666;">📱 ${agentPhone}</p>` : ''}
              </div>

              <p style="font-size: 14px; color: #999; margin-top: 30px;">
                If you have any questions about these properties or would like to schedule a viewing, please don't hesitate to reach out!
              </p>
            </div>
            
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999;">
              <p style="margin: 0;">This email was sent on behalf of ${agentName}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enqueue job instead of sending directly
    const { error: insertError } = await supabase
      .from("email_jobs")
      .insert({
        payload: {
          provider: "resend",
          template: "bulk-listing-share",
          to: recipientEmail,
          subject: `${agentName} shared ${listings.length} property listing${listings.length > 1 ? 's' : ''} with you`,
          html: emailHtml,
          reply_to: agentEmail,
          variables: {
            recipientName,
            agentName,
            listingCount: listings.length,
          },
        },
      });

    if (insertError) {
      console.error("[send-bulk-listing-share] Failed to enqueue job:", insertError);
      throw new Error("Failed to queue email for sending");
    }

    console.log("[send-bulk-listing-share] Job enqueued successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Email queued for delivery" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-bulk-listing-share] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);