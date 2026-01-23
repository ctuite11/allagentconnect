import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  email: string;
  first_name?: string;
  last_name?: string;
}

interface ReverseProspectingRequest {
  recipients: Recipient[];
  agentName: string;
  agentEmail: string;
  agentPhone?: string;
  message: string;
  listingAddress?: string;
  listingPrice?: string;
  filters: {
    state?: string;
    city?: string;
    propertyType?: string;
  };
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
  // Handle CORS preflight requests
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

    // Database-backed rate limiting: 5 reverse prospecting campaigns per minute per IP
    if (supabaseUrl && supabaseAnonKey) {
      const rateLimitKey = `route:send-reverse-prospecting|ip:${ip}`;
      const rateLimitResult = await checkRateLimit(supabaseUrl, supabaseAnonKey, rateLimitKey, 60, 5);
      
      if (!rateLimitResult.allowed) {
        console.log(`[rate-limit] Blocked IP: ${ip}, count: ${rateLimitResult.current_count}`);
        return build429Response(rateLimitResult.reset_at);
      }
    }

    const {
      recipients,
      agentName,
      agentEmail,
      agentPhone,
      message,
      listingAddress,
      listingPrice,
      filters,
    }: ReverseProspectingRequest = await req.json();

    console.log(`Sending reverse prospecting emails to ${recipients.length} recipients`);

    // Send emails to all recipients
    const emailPromises = recipients.map(async (recipient) => {
      const recipientName = recipient.first_name
        ? `${recipient.first_name} ${recipient.last_name || ""}`.trim()
        : "there";

      let listingDetails = "";
      if (listingAddress || listingPrice) {
        listingDetails = `
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Listing Details</h3>
            ${listingAddress ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${listingAddress}</p>` : ""}
            ${listingPrice ? `<p style="margin: 5px 0;"><strong>Price:</strong> ${listingPrice}</p>` : ""}
          </div>
        `;
      }

      let filterSummary = "";
      const filterParts = [];
      if (filters.propertyType) {
        const formattedType = filters.propertyType
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        filterParts.push(formattedType);
      }
      if (filters.city) filterParts.push(filters.city);
      if (filters.state) filterParts.push(filters.state);

      if (filterParts.length > 0) {
        filterSummary = `<p style="color: #666; margin: 15px 0;">This property matches your search for: <strong>${filterParts.join(", ")}</strong></p>`;
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">New Property Match</h1>
            </div>
            
            <div style="background-color: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Hi ${recipientName},</p>
              
              ${filterSummary}
              
              <div style="margin: 25px 0; padding: 20px; background-color: #fafafa; border-left: 4px solid #667eea; border-radius: 4px;">
                <p style="margin: 0; white-space: pre-wrap;">${message}</p>
              </div>
              
              ${listingDetails}
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <h3 style="margin: 0 0 15px 0; color: #333;">Contact Information</h3>
                <p style="margin: 5px 0;"><strong>Agent:</strong> ${agentName}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${agentEmail}" style="color: #667eea;">${agentEmail}</a></p>
                ${agentPhone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${agentPhone}</p>` : ""}
              </div>
              
              <div style="margin-top: 30px; padding: 15px; background-color: #f0f7ff; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #555;">
                  Interested in this property? Reply to this email or contact the agent directly.
                </p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>This email was sent because your buying criteria matches this listing.</p>
            </div>
          </body>
        </html>
      `;

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "All Agent Connect <noreply@mail.allagentconnect.com>",
            to: [recipient.email],
            reply_to: agentEmail,
            subject: `New Property Match: ${listingAddress || "Property Available"}`,
            html: html,
          }),
        });

        if (!response.ok) {
          throw new Error(`Resend API error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Email sent to ${recipient.email}:`, data);
        return { success: true, email: recipient.email };
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        return { success: false, email: recipient.email, error };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`Emails sent: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        results,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-reverse-prospecting function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
