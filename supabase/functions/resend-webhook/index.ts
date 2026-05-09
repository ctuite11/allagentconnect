import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/**
 * Verify Svix-style webhook signature used by Resend.
 * Header `svix-signature` is space-separated list like "v1,<base64sig> v1,<base64sig>".
 * Signed payload = `${svix_id}.${svix_timestamp}.${rawBody}`.
 * Secret is "whsec_..." — base64 portion after the prefix is the HMAC key.
 */
async function verifySvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string,
): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Reject events older than 5 minutes (replay protection)
  const tsSec = Number(svixTimestamp);
  if (!Number.isFinite(tsSec)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsSec) > 5 * 60) return false;

  const secretBody = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = decodeBase64(secretBody);
  } catch {
    // Allow raw secret as fallback
    keyBytes = new TextEncoder().encode(secretBody);
  }

  const rawKey = new Uint8Array(keyBytes).buffer;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedPayload),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  // svix-signature can contain multiple "v1,sig" entries separated by spaces
  const candidates = svixSignature.split(" ").map((p) => {
    const idx = p.indexOf(",");
    return idx >= 0 ? p.slice(idx + 1) : p;
  });

  return candidates.some((sig) => sig === expected);
}

function normalizeStatus(eventType: string): string {
  // Map Resend event types to a normalized delivery_status enum-ish value.
  switch (eventType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.delivery_delayed":
      return "delayed";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.failed":
      return "failed";
    default:
      return eventType;
  }
}

// Order of "advancement" — webhook events can arrive out-of-order; we only
// overwrite delivery_status if the new status represents progress (or terminal).
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delayed: 2,
  opened: 3,
  clicked: 4,
  delivered: 5,
  bounced: 9,
  complained: 9,
  failed: 9,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[resend-webhook] Missing Supabase env vars");
    return json({ error: "config" }, { status: 500 });
  }

  const rawBody = await req.text();

  // Signature verification (skipped only if no secret configured — log loudly)
  if (WEBHOOK_SECRET) {
    const ok = await verifySvixSignature(
      rawBody,
      req.headers.get("svix-id"),
      req.headers.get("svix-timestamp"),
      req.headers.get("svix-signature"),
      WEBHOOK_SECRET,
    );
    if (!ok) {
      console.warn("[resend-webhook] Signature verification failed");
      return json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "[resend-webhook] RESEND_WEBHOOK_SECRET not configured — accepting unverified payload",
    );
  }

  let evt: Record<string, unknown>;
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid json" }, { status: 400 });
  }

  const eventType =
    typeof evt.type === "string" ? (evt.type as string) : "unknown";
  const data = (evt.data ?? {}) as Record<string, unknown>;
  const providerMessageId =
    typeof data.email_id === "string"
      ? (data.email_id as string)
      : typeof (data as { id?: unknown }).id === "string"
        ? ((data as { id: string }).id)
        : null;
  const createdAt =
    typeof evt.created_at === "string"
      ? (evt.created_at as string)
      : new Date().toISOString();

  const recipientRaw = (data.to ?? null) as unknown;
  const recipient = Array.isArray(recipientRaw)
    ? (recipientRaw as unknown[]).filter((x) => typeof x === "string").join(",")
    : typeof recipientRaw === "string"
      ? (recipientRaw as string)
      : null;

  const normalized = normalizeStatus(eventType);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve email_jobs.id by provider_message_id
  let jobId: string | null = null;
  if (providerMessageId) {
    const { data: jobRow, error: jobErr } = await supabase
      .from("email_jobs")
      .select("id, delivery_status")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (jobErr) {
      console.error("[resend-webhook] job lookup failed:", jobErr);
    }

    if (jobRow) {
      jobId = jobRow.id as string;

      // Only advance delivery_status if new rank >= current rank,
      // so out-of-order webhooks don't regress state.
      const currentRank =
        STATUS_RANK[jobRow.delivery_status as string] ?? -1;
      const newRank = STATUS_RANK[normalized] ?? 0;

      if (newRank >= currentRank) {
        const { error: updErr } = await supabase
          .from("email_jobs")
          .update({
            delivery_status: normalized,
            delivery_status_at: createdAt,
          })
          .eq("id", jobId);
        if (updErr) {
          console.error(
            "[resend-webhook] email_jobs status update failed:",
            updErr,
          );
        }
      }
    } else {
      console.warn(
        `[resend-webhook] No matching email_jobs row for provider_message_id=${providerMessageId} (event=${eventType})`,
      );
    }
  }

  // Always log the raw webhook into email_events for audit, even if unmatched.
  // job_id is required (NOT NULL) — if we couldn't resolve, skip the insert
  // and rely on the Edge Function logs as the audit trail.
  if (jobId) {
    const { error: evtErr } = await supabase.from("email_events").insert({
      job_id: jobId,
      event: normalized,
      detail: {
        provider_event_type: eventType,
        raw: evt,
      },
      provider_message_id: providerMessageId,
      recipient_email: recipient,
      provider_event_at: createdAt,
      source: "resend_webhook",
    });
    if (evtErr) {
      console.error("[resend-webhook] email_events insert failed:", evtErr);
    }
  } else {
    console.log(
      `[resend-webhook] Unmatched event ${eventType} message_id=${providerMessageId} recipient=${recipient}`,
    );
  }

  // Spam complaints → mark recipient(s) as fully unsubscribed.
  if (normalized === "complained" && recipient) {
    const emails = recipient.split(",").map((s) => s.trim()).filter(Boolean);
    for (const em of emails) {
      const { error: unsubErr } = await supabase
        .from("email_unsubscribes")
        .upsert(
          { email: em, category: "all", source: "complaint" },
          { onConflict: "email_lower,category", ignoreDuplicates: true },
        );
      if (unsubErr) console.error("[resend-webhook] complaint unsubscribe failed:", unsubErr);
    }
  }

  return json({
    ok: true,
    event: eventType,
    normalized,
    matched_job_id: jobId,
    provider_message_id: providerMessageId,
  });
});