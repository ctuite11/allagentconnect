import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { verifyTurnstileToken, TURNSTILE_GENERIC_ERROR } from "../_shared/verifyTurnstile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_TO_EMAIL = "hello@allagentconnect.com";
const SUPPORT_TO_NAME = "AAC Support";

interface ContactEmailRequest {
  /** Required for listing inquiries: backend resolves the recipient from this ID. */
  listingId?: string;
  /**
   * Access-error / platform support only. Destination is hardcoded server-side;
   * callers cannot choose the recipient.
   */
  purpose?: "support";
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  /** Optional display context (not used for recipient resolution). */
  listingAddress?: string;
  turnstile_token?: string;
}

/**
 * Resolves the destination agent email and listing address server-side from a
 * listing ID, using the public-eligibility-gated RPCs. Returns null when the
 * listing is not publicly eligible (e.g. draft) or does not exist.
 */
async function resolveListingRecipient(
  supabaseUrl: string,
  serviceKey: string,
  listingId: string
): Promise<{ email: string; name: string; address: string } | null> {
  const admin = createClient(supabaseUrl, serviceKey);

  const [{ data: listingRows, error: listingErr }, { data: agentRows, error: agentErr }] =
    await Promise.all([
      admin.rpc("get_public_listing", { p_listing_id: listingId }),
      admin.rpc("get_public_listing_agent", { p_listing_id: listingId }),
    ]);

  if (listingErr || agentErr) {
    console.error("[send-contact-email] listing resolve error:", listingErr || agentErr);
    return null;
  }

  const listing = Array.isArray(listingRows) ? listingRows[0] : listingRows;
  const agent = Array.isArray(agentRows) ? agentRows[0] : agentRows;
  if (!listing || !agent?.email) return null;

  const address = [
    listing.address,
    listing.unit_number ? `#${listing.unit_number}` : "",
    listing.city,
    listing.state,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    email: agent.email,
    name: [agent.first_name, agent.last_name].filter(Boolean).join(" ").trim() || "there",
    address,
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

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    // Database-backed rate limiting: 10 contact emails per minute per IP
    if (supabaseUrl && supabaseAnonKey) {
      const rateLimitKey = `route:send-contact-email|ip:${ip}`;
      const rateLimitResult = await checkRateLimit(supabaseUrl, supabaseAnonKey, rateLimitKey, 60, 10);
      
      if (!rateLimitResult.allowed) {
        console.log(`[rate-limit] Blocked IP: ${ip}, count: ${rateLimitResult.current_count}`);
        return build429Response(rateLimitResult.reset_at);
      }
    }

    const {
      listingId,
      purpose,
      senderName,
      senderEmail,
      senderPhone,
      message,
      listingAddress,
      turnstile_token,
    }: ContactEmailRequest = await req.json();

    // Server-side Cloudflare Turnstile verification — blocks direct API abuse.
    const turnstileResult = await verifyTurnstileToken(turnstile_token, req);
    if (!turnstileResult.ok) {
      return new Response(
        JSON.stringify({ error: TURNSTILE_GENERIC_ERROR }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }

    let toEmail: string | undefined;
    let toName: string | undefined;
    let addressLine = listingAddress || "";

    if (purpose === "support") {
      // Access-error / platform support: fixed inbox only. Never trust a
      // caller-supplied destination address.
      toEmail = SUPPORT_TO_EMAIL;
      toName = SUPPORT_TO_NAME;
      addressLine = addressLine || "Access Error — Support Request";
      console.log("[send-contact-email] support purpose →", SUPPORT_TO_EMAIL);
    } else if (listingId && UUID_RE.test(listingId)) {
      const resolved = await resolveListingRecipient(supabaseUrl, supabaseServiceKey, listingId);
      if (!resolved) {
        return new Response(JSON.stringify({ error: "Listing not available" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      toEmail = resolved.email;
      toName = resolved.name;
      addressLine = resolved.address || addressLine;
      console.log("[send-contact-email] listingId resolve →", listingId);
    } else {
      return new Response(
        JSON.stringify({ error: "listingId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "Missing recipient" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Minimal plain HTML — no AAC header, logo, footer, tracking, or marketing layout.
    const htmlOut = `<!DOCTYPE html>
<html><body>
<h2>Message about ${escapeHtml(addressLine)}</h2>
<p><strong>From:</strong> ${escapeHtml(senderName)}</p>
<p><strong>Email:</strong> ${escapeHtml(senderEmail)}</p>
${senderPhone ? `<p><strong>Phone:</strong> ${escapeHtml(senderPhone)}</p>` : ""}
<p><strong>Message:</strong></p>
<p>${escapeHtml(message)}</p>
<p>You can reply directly to this email.</p>
</body></html>`;

    const text = [
      `Hi ${toName},`,
      ``,
      `You received a new message on your listing:`,
      addressLine,
      ``,
      `Contact Details`,
      `Name:  ${senderName}`,
      `Email: ${senderEmail}`,
      ...(senderPhone ? [`Phone: ${senderPhone}`] : []),
      ``,
      `Message`,
      message,
      ``,
      `You can reply directly to this email.`,
    ].join("\n");

    // DELIVERABILITY TEST: route Listing → Message Agent through the same
    // queued email_jobs + worker path that delivers AAC Messages notifications
    // (inboxing from chris@allagentconnect.com).
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: jobRow, error: enqueueError } = await admin
      .from("email_jobs")
      .insert({
        payload: {
          provider: "resend",
          template: "listing-contact-inquiry",
          to: toEmail,
          subject: `Message about ${addressLine}`,
          html: htmlOut,
        },
      })
      .select("id")
      .single();

    if (enqueueError) {
      console.error("[send-contact-email] enqueue failed:", enqueueError);
      throw enqueueError;
    }

    // Kick the queue so the worker dispatches immediately instead of waiting
    // for the next cron tick.
    void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((err) => {
      console.warn("[send-contact-email] kick-email-queue failed (will run on schedule):", err);
    });

    // Keep `text` in scope to avoid TS unused warnings; not used on queued path
    // because the worker derives plaintext from html.
    void text;

    console.log("Listing contact email enqueued:", jobRow?.id);

    return new Response(JSON.stringify({ enqueued: true, jobId: jobRow?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending contact email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
