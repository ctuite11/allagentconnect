// @auth-classification: public-unauthenticated (single-use handle, POST-only)
//
// Issues a replacement activation link from a single-use resend handle.
//
// The handle is consumed inside `redeem_resend_handle_and_issue`, the same
// transaction that creates the replacement token AND the transactional email
// job. If any step fails, the transaction rolls back and the handle remains
// UNUSED — a transient database failure can never burn the agent's resend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  ACTIVATION_TOKEN_TTL_DAYS,
  sha256Hex,
  signActivationToken,
} from "../_shared/activationTokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ status: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SECRET = Deno.env.get("ACTIVATION_TOKEN_SECRET");
  if (!SUPABASE_URL || !SERVICE_KEY || !SECRET) {
    console.error("[resend-activation-link] missing configuration");
    return json({ status: "error" }, 500);
  }

  let handle = "";
  try {
    const body = await req.json();
    handle = typeof body?.handle === "string" ? body.handle.trim() : "";
  } catch {
    handle = "";
  }

  // Uniform response: never reveal whether a handle was real.
  const generic = json({ status: "ok" });
  if (!handle || handle.length > 200) return generic;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Pre-generate the replacement record id so the HMAC can be built from it.
  const newId = crypto.randomUUID();
  const expiresAt = new Date(
    Math.floor(Date.now() / 1000) * 1000 + ACTIVATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  // We need the user id to sign, but the handle owns that binding. Resolve it
  // read-only first; the authoritative validation still happens in the RPC.
  const { data: handleRow } = await admin
    .from("agent_activation_resend_handles")
    .select("user_id,used_at,expires_at")
    .eq("handle_hash", await sha256Hex(handle))
    .maybeSingle();

  if (!handleRow || handleRow.used_at || new Date(handleRow.expires_at) <= new Date()) {
    return generic;
  }

  const token = await signActivationToken(SECRET, {
    id: newId,
    userId: handleRow.user_id,
    expiresAtEpoch: Math.floor(expiresAt.getTime() / 1000),
  });

  const { data: result, error } = await admin.rpc("redeem_resend_handle_and_issue", {
    p_handle_hash: await sha256Hex(handle),
    p_new_token_id: newId,
    p_new_token_hash: await sha256Hex(token),
    p_expires_at: expiresAt.toISOString(),
    p_subject: null,
    p_reply_to: null,
    p_agent_name: null,
  });

  if (error) {
    // Handle is still unused — the whole transaction rolled back.
    console.error("[resend-activation-link] atomic resend failed:", error.message);
    return generic;
  }

  const status = (result as { status?: string } | null)?.status ?? "unknown";
  if (status === "created" || status === "deduped") {
    void fetch(`${SUPABASE_URL}/functions/v1/kick-email-queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
  } else {
    console.warn("[resend-activation-link] not issued:", status);
  }

  return generic;
});
