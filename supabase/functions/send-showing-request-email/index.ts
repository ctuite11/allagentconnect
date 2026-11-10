import "../_shared/migrationRuntime.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { verifiedPrivacyClient } from "../_shared/privacyAuth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShowingRequestEmailRequest {
  /** Required: backend resolves the listing agent + email from this ID. */
  listingId: string;
  hotSheetId?: string;
  dcmls?: boolean;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  /** Optional display context (not used for recipient resolution). */
  listingAddress?: string;
  preferredDate: string;
  preferredTime: string;
  message?: string;
  photoUrl?: string;
}

async function resolveListingRecipient(
  admin: NonNullable<Awaited<ReturnType<typeof verifiedPrivacyClient>>>["client"],
  listingId: string
): Promise<{ email: string; name: string; address: string } | null> {
  const [{ data: listingRows, error: listingErr }, { data: agentRows, error: agentErr }] =
    await Promise.all([
      admin.rpc("get_public_listing", { p_listing_id: listingId }),
      admin.rpc("get_public_listing_agent", { p_listing_id: listingId }),
    ]);

  if (listingErr || agentErr) {
    console.error("[send-showing-request-email] listing resolve error:", listingErr || agentErr);
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
    return { allowed: false, remaining: 0, reset_at: new Date().toISOString(), current_count: limit };
  }

  return (Array.isArray(data) ? data[0] : data) ?? { allowed: false, remaining: 0, reset_at: new Date().toISOString(), current_count: limit };
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

/** Form sends YYYY-MM-DD; display as "May 27, 2026". */
function formatPreferredDate(dateInput: string): string {
  const trimmed = dateInput?.trim();
  if (!trimmed) return dateInput;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const d = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return trimmed;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await verifiedPrivacyClient(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const limiterKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Get IP for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown";

    // Database-backed rate limiting: 10 showing requests per minute per IP
    if (supabaseUrl && limiterKey) {
      const rateLimitKey = `route:send-showing-request-email|ip:${ip}`;
      const rateLimitResult = await checkRateLimit(supabaseUrl, limiterKey, rateLimitKey, 60, 10);
      
      if (!rateLimitResult.allowed) {
        console.log(`[rate-limit] Blocked IP: ${ip}, count: ${rateLimitResult.current_count}`);
        return build429Response(rateLimitResult.reset_at);
      }
    }

    const {
      listingId,
      hotSheetId,
      dcmls,
      requesterName,
      requesterEmail,
      requesterPhone,
      listingAddress,
      preferredDate,
      preferredTime,
      message,
      photoUrl,
    }: ShowingRequestEmailRequest = await req.json();

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }

    if (!listingId || !UUID_RE.test(listingId) || (hotSheetId != null && !UUID_RE.test(hotSheetId)) ||
      typeof requesterName !== "string" || requesterName.trim().length < 1 || requesterName.length > 100 ||
      typeof requesterEmail !== "string" || requesterEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail) ||
      typeof preferredDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ||
      typeof preferredTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preferredTime) ||
      (message != null && (typeof message !== "string" || message.length > 1000))) {
      return new Response(
        JSON.stringify({ error: "Invalid showing request" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    let resolved: { email: string; name: string; address: string } | null = null;
    if (caller && !dcmls) resolved = await resolveListingRecipient(caller.client, listingId);
    else if (!dcmls && req.headers.get("Authorization")?.startsWith("Bearer ")) {
      const client = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      });
      const { data: identity, error: identityError } = await client.auth.getUser();
      if (!identityError && identity.user) {
        const { data: scoped, error } = await client.rpc("get_buyer_listing", {
          p_listing_id: listingId, p_hot_sheet_id: hotSheetId ?? null,
        });
        if (!error && scoped?.listing && scoped.agent?.email) resolved = {
          email: scoped.agent.email, name: [scoped.agent.first_name,scoped.agent.last_name].filter(Boolean).join(" "),
          address: [scoped.listing.address,scoped.listing.unit_number,scoped.listing.city,scoped.listing.state].filter(Boolean).join(", "),
        };
      }
    }
    if (dcmls || !req.headers.get("Authorization")) {
      const [{ data: rows, error: listingError }, { data: agent, error: agentError }] = await Promise.all([
        admin.rpc("get_dcmls_listing", { p_listing_id: listingId }),
        admin.rpc("get_dcmls_listing_agent", { p_listing_id: listingId }),
      ]);
      const listing = Array.isArray(rows) ? rows[0] : rows;
      if (!listingError && !agentError && listing && agent?.email) resolved = {
        email: agent.email, name: [agent.first_name,agent.last_name].filter(Boolean).join(" "),
        address: [listing.address,listing.unit_number,listing.city,listing.state].filter(Boolean).join(", "),
      };
    }
    if (!resolved) {
      return new Response(JSON.stringify({ error: "Listing not available" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const toEmail = resolved.email;
    const toName = resolved.name;
    const addressLine = resolved.address || listingAddress || "";

    // Save only after the server has authorized the listing and resolved scope.
    const { error: requestError } = await admin.from("showing_requests").insert({
      listing_id: listingId, requester_name: requesterName.trim(), requester_email: requesterEmail,
      requester_phone: requesterPhone || null, preferred_date: preferredDate, preferred_time: preferredTime,
      message: message || null,
    });
    if (requestError) throw requestError;

    const formattedDate = formatPreferredDate(preferredDate);
    const safeListingAddress = escapeHtml(addressLine);
    void photoUrl;

    const htmlOut = `<!DOCTYPE html>
<html><body>
<h2>Showing request: ${safeListingAddress}</h2>
<p><strong>Requester:</strong> ${escapeHtml(requesterName)}</p>
<p><strong>Email:</strong> ${escapeHtml(requesterEmail)}</p>
${requesterPhone ? `<p><strong>Phone:</strong> ${escapeHtml(requesterPhone)}</p>` : ""}
<p><strong>Preferred date:</strong> ${escapeHtml(formattedDate)}</p>
<p><strong>Preferred time:</strong> ${escapeHtml(preferredTime)}</p>
${message ? `<p><strong>Message:</strong></p><p>${escapeHtml(message)}</p>` : ""}
<p>You can reply directly to this email.</p>
</body></html>`;

    const text = [
      `Showing request: ${addressLine}`,
      ``,
      `Requester: ${requesterName}`,
      `Email: ${requesterEmail}`,
      ...(requesterPhone ? [`Phone: ${requesterPhone}`] : []),
      `Preferred date: ${formattedDate}`,
      `Preferred time: ${preferredTime}`,
      ...(message ? [``, `Message:`, message] : []),
      ``,
      `You can reply directly to this email.`,
    ].join("\n");

    // DELIVERABILITY: route Schedule a Showing through the same queued
    // email_jobs + worker path as AAC Messages and the Listing → Message
    // Agent route (both reliably inboxing). Drop direct Resend SDK call
    // and Reply-To to mirror the proven-inboxing pattern.
    const { data: jobRow, error: enqueueError } = await admin
      .from("email_jobs")
      .insert({
        payload: {
          provider: "resend",
          template: "showing-request",
          privacy: { version: 1, audience: "agent", listing_ids: [listingId] },
          to: toEmail,
          subject: `Showing request: ${addressLine}`,
          html: htmlOut,
        },
      })
      .select("id")
      .single();

    if (enqueueError) {
      console.error("[send-showing-request-email] enqueue failed:", enqueueError);
      throw enqueueError;
    }

    void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((err) => {
      console.warn("[send-showing-request-email] kick-email-queue failed (will run on schedule):", err);
    });

    // Keep references to avoid TS unused warnings (worker derives text from html).
    void text;
    void RESEND_API_KEY;
    void toName;

    console.log("Showing request email enqueued:", jobRow?.id);

    return new Response(JSON.stringify({ enqueued: true, jobId: jobRow?.id }), {
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
