// @auth-classification: token-redemption (public, token-bearing, POST-only)
//
// Redeems an AAC-owned activation token. Invoked ONLY by the same-origin
// Netlify proxy at /api/activate-redeem after the user clicks "Activate".
//
// Guarantees:
//  * POST only — no GET, so the token can never be redeemed by a link
//    prefetcher, mail scanner, or browser preview.
//  * The token arrives in the request BODY, never a query string.
//  * A fresh Supabase recovery link is generated only after an atomic,
//    single-winner claim on the token row.
//  * Failure paths release the reservation and mint a single-use resend
//    handle so the agent is never stranded.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  epochSeconds,
  newResendHandle,
  parseActivationToken,
  sha256Hex,
  verifyActivationToken,
} from "../_shared/activationTokens.ts";
import { AAC_PUBLIC_URL, wrapSupabaseActionLinkForAac } from "../_shared/aacPublicUrl.ts";

const SETUP_REDIRECT = `${AAC_PUBLIC_URL}/auth/callback?type=recovery&setup=1`;

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
    console.error("[redeem-activation-token] missing configuration");
    return json({ status: "config" }, 500);
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

  // Atomic single-winner claim (also validates status / expiry / eligibility).
  const { data: claim, error: claimErr } = await admin.rpc("claim_agent_activation_token", {
    p_token_hash: tokenHash,
  });
  if (claimErr) {
    console.error("[redeem-activation-token] claim failed:", claimErr.message);
    return json({ status: "error" }, 500);
  }

  const claimStatus = (claim as { status?: string } | null)?.status ?? "invalid";
  const tokenId = (claim as { token_id?: string } | null)?.token_id ?? null;

  // Non-claimed outcomes: offer a secure resend when a real record exists.
  if (claimStatus !== "claimed") {
    let handle: string | null = null;
    if (tokenId && ["expired", "revoked", "in_progress"].includes(claimStatus)) {
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
    return json({ status: claimStatus, resendHandle: handle });
  }

  const userId = (claim as { user_id: string }).user_id;

  const release = async () => {
    await admin.rpc("release_agent_activation_token", { p_token_id: tokenId });
  };

  // Re-derive the signature from the stored record. A forged or tampered
  // token cannot reach this point with a matching hash, but verifying the
  // HMAC keeps hash-collision and stale-record paths closed.
  const { data: row, error: rowErr } = await admin
    .from("agent_activation_tokens")
    .select("id,user_id,expires_at")
    .eq("id", tokenId)
    .maybeSingle();
  if (rowErr || !row) {
    await release();
    return json({ status: "error" }, 500);
  }

  const signatureOk = await verifyActivationToken(SECRET, token, {
    id: row.id,
    userId: row.user_id,
    expiresAtEpoch: epochSeconds(row.expires_at),
  });
  if (!signatureOk) {
    await release();
    console.warn("[redeem-activation-token] signature mismatch for token id", tokenId);
    return json({ status: "invalid" }, 400);
  }

  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
  const email = userRes?.user?.email;
  if (userErr || !email) {
    await release();
    return json({ status: "error" }, 500);
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: SETUP_REDIRECT },
  });
  const actionLink = link?.properties?.action_link;
  if (linkErr || !actionLink) {
    await release();
    console.error("[redeem-activation-token] generateLink failed:", linkErr);
    return json({ status: "error" }, 500);
  }

  const { data: completed } = await admin.rpc("complete_agent_activation_token", {
    p_token_id: tokenId,
  });
  if (completed !== true) {
    // Someone else finished it first — do not hand out a second link.
    return json({ status: "used" });
  }

  return json({ status: "ok", redirect: wrapSupabaseActionLinkForAac(actionLink) });
});
