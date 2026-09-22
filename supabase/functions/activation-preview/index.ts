// @auth-classification: token-preview (public, token-bearing, POST-only, READ-ONLY)
//
// Returns the details the /activate setup form needs to prefill itself.
//
// Guarantees:
//  * POST only — a link prefetcher or mail scanner performing a GET gets 405.
//  * The token arrives in the request BODY, never a query string.
//  * The full HMAC signature is verified against the stored record BEFORE any
//    profile information is returned.
//  * Read-only: no claim, no completion, no activation marker, no session,
//    no password change, no email.
//  * Same status vocabulary as redeem-activation-token, and the same
//    single-use resend handle on exactly the states that allow one today.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  epochSeconds,
  newResendHandle,
  parseActivationToken,
  sha256Hex,
  verifyActivationToken,
} from "../_shared/activationTokens.ts";
import {
  activationRateLimited,
  clientIpFrom,
  enforceActivationPreviewLimits,
} from "../_shared/activationRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const RESEND_STATES = new Set(["expired", "revoked", "in_progress"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ status: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SECRET = Deno.env.get("ACTIVATION_TOKEN_SECRET");
  if (!SUPABASE_URL || !SERVICE_KEY || !SECRET) {
    console.error("[activation-preview] missing configuration");
    return json({ status: "error" }, 500);
  }

  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return json({ status: "invalid" }, 400);
  }

  const parsed = parseActivationToken(token);
  if (!parsed) return json({ status: "invalid" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const tokenHash = await sha256Hex(token);

  // Throttle BEFORE any lookup. This only increments a counter keyed by the
  // token hash / caller IP — it never reads, claims or consumes the token, and
  // the 429 body is identical for valid, expired and non-existent tokens.
  const limit = await enforceActivationPreviewLimits(admin, tokenHash, clientIpFrom(req));
  if (!limit.allowed) return activationRateLimited(limit.resetAt, corsHeaders);

  const { data: preview, error } = await admin.rpc("preview_agent_activation_token", {
    p_token_hash: tokenHash,
  });
  if (error) {
    console.error("[activation-preview] lookup failed:", error.message);
    return json({ status: "error" }, 500);
  }

  const row = (preview ?? {}) as Record<string, unknown>;
  const status = typeof row.status === "string" ? row.status : "invalid";
  const tokenId = typeof row.token_id === "string" ? row.token_id : null;

  if (status !== "ok") {
    let handle: string | null = null;
    if (tokenId && RESEND_STATES.has(status)) {
      handle = newResendHandle();
      const { data: issued, error: handleErr } = await admin.rpc(
        "issue_activation_resend_handle",
        {
          p_token_id: tokenId,
          p_handle_hash: await sha256Hex(handle),
          p_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      );
      if (handleErr || issued !== true) handle = null;
    }
    return json({ status, resendHandle: handle });
  }

  // Verify the signature before disclosing anything about the account.
  const signatureOk = await verifyActivationToken(SECRET, token, {
    id: String(row.token_id),
    userId: String(row.user_id),
    expiresAtEpoch: epochSeconds(String(row.expires_at)),
  });
  if (!signatureOk) {
    console.warn("[activation-preview] signature mismatch for token id", tokenId);
    return json({ status: "invalid" }, 400);
  }

  // Minimum fields the setup form needs — nothing else.
  return json({
    status: "ok",
    email: typeof row.email === "string" ? row.email : "",
    firstName: typeof row.first_name === "string" ? row.first_name : "",
    lastName: typeof row.last_name === "string" ? row.last_name : "",
    company: typeof row.company === "string" ? row.company : "",
  });
});
