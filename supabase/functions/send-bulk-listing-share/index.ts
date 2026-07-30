import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildBulkListingShareEmailSubject } from "../_shared/listingEmailSubject.ts";

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

  // Handle array or single object return from RPC
  const row = Array.isArray(data) ? data[0] : data;
  return row as RateLimitResult;
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

    // Normalize listings for the unified renderer
    const normalizedListings = listings.map((l: any) => {
      const photos = l.photos || [];
      const photoUrl = Array.isArray(photos) && photos.length > 0
        ? (typeof photos[0] === "string" ? photos[0] : (photos[0] as any)?.url || "")
        : "";
      return {
        address: l.address,
        city: l.city,
        state: l.state,
        zipCode: l.zip_code,
        unit_number: l.unit_number,
        condo_details: l.condo_details,
        price: l.price,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        squareFeet: l.square_feet,
        propertyType: l.property_type,
        photoUrl,
      };
    });

    // Enqueue job — rendered server-side via the AAC unified template (renderEmailTemplate)
    const { error: insertError } = await supabase
      .from("email_jobs")
      .insert({
        stream: "transactional",
        payload: {
          provider: "resend",
          template: "bulk-listing-share",
          to: recipientEmail,
          subject: buildBulkListingShareEmailSubject(
            agentName,
            listings.map((l: { address: string; city: string; state: string; zip_code: string; unit_number?: string; condo_details?: unknown; property_type?: string }) => ({
              address: l.address,
              city: l.city,
              state: l.state,
              zip_code: l.zip_code,
              unit_number: l.unit_number,
              condo_details: l.condo_details,
              property_type: l.property_type,
            })),
          ),
          reply_to: agentEmail,
          variables: {
            recipientName,
            agentName,
            agentEmail,
            agentPhone,
            message,
            listings: normalizedListings,
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