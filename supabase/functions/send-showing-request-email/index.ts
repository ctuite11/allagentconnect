import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

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

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  current_count: number;
}

async function checkRateLimit(
  supabaseUrl: string,
  supabaseKey: string,
  key: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  const supabase = createClient(supabaseUrl, supabaseKey);
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    // Get IP for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown";

    // Database-backed rate limiting: 10 showing requests per minute per IP
    if (supabaseUrl && supabaseAnonKey) {
      const rateLimitKey = `route:send-showing-request-email|ip:${ip}`;
      const rateLimitResult = await checkRateLimit(supabaseUrl, supabaseAnonKey, rateLimitKey, 60, 10);
      
      if (!rateLimitResult.allowed) {
        console.log(`[rate-limit] Blocked IP: ${ip}, count: ${rateLimitResult.current_count}`);
        return build429Response(rateLimitResult.reset_at);
      }
    }

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
