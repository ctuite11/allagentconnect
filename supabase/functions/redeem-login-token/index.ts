// @auth-classification: token-redemption (public, token-bearing, POST-only)
//
// Redeems an AAC-owned 7-day login token and returns a freshly minted,
// short-lived Supabase magic link. Invoked ONLY by the same-origin Netlify
// proxy at /api/login-redeem after the user presses "Sign In".
//
// Guarantees:
//  * POST only — a prefetcher or mail scanner can never burn the token.
//  * The token arrives in the request BODY, never a query string.
//  * The auth link is generated only after an atomic, single-winner claim.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { epochSeconds, parseLoginToken, sha256Hex, verifyLoginToken } from "../_shared/loginTokens.ts";
import { AAC_PUBLIC_URL, wrapSupabaseActionLinkForAac } from "../_shared/aacPublicUrl.ts";

const LOGIN_REDIRECT = `${AAC_PUBLIC_URL}/auth/callback?type=magiclink`;

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
    console.error("[redeem-login-token] missing configuration");
    return json({ status: "config" }, 500);
  }

  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return json({ status: "invalid" }, 400);
  }

  if (!parseLoginToken(token)) return json({ status: "invalid" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const tokenHash = await sha256Hex(token);

  const { data: claim, error: claimErr } = await admin.rpc("claim_agent_login_token", {
    p_token_hash: tokenHash,
  });
  if (claimErr) {
    console.error("[redeem-login-token] claim failed:", claimErr.message);
    return json({ status: "error" }, 500);
  }

  const claimStatus = (claim as { status?: string } | null)?.status ?? "invalid";
  const tokenId = (claim as { token_id?: string } | null)?.token_id ?? null;
  if (claimStatus !== "claimed") {
    return json({ status: claimStatus });
  }

  const userId = (claim as { user_id: string }).user_id;
  const release = async () => {
    await admin.rpc("release_agent_login_token", { p_token_id: tokenId });
  };

  // Re-derive the signature from the stored record.
  const { data: row, error: rowErr } = await admin
    .from("agent_login_tokens")
    .select("id,user_id,expires_at")
    .eq("id", tokenId)
    .maybeSingle();
  if (rowErr || !row) {
    await release();
    return json({ status: "error" }, 500);
  }

  const signatureOk = await verifyLoginToken(SECRET, token, {
    id: row.id,
    userId: row.user_id,
    expiresAtEpoch: epochSeconds(row.expires_at),
  });
  if (!signatureOk) {
    await release();
    console.warn("[redeem-login-token] signature mismatch for token id", tokenId);
    return json({ status: "invalid" }, 400);
  }

  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
  const email = userRes?.user?.email;
  if (userErr || !email) {
    await release();
    return json({ status: "error" }, 500);
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: LOGIN_REDIRECT },
  });
  const actionLink = link?.properties?.action_link;
  if (linkErr || !actionLink) {
    await release();
    console.error("[redeem-login-token] generateLink failed:", linkErr);
    return json({ status: "error" }, 500);
  }

  const { data: completed } = await admin.rpc("complete_agent_login_token", {
    p_token_id: tokenId,
  });
  if (completed !== true) {
    // Someone else finished it first — never hand out a second link.
    return json({ status: "used" });
  }

  return json({ status: "ok", redirect: wrapSupabaseActionLinkForAac(actionLink) });
});
