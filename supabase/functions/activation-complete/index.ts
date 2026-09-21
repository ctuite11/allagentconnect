// @auth-classification: token-redemption (public, token-bearing, POST-only)
//
// The single explicit submission that completes agent activation:
// saves the required profile fields, sets the password, stamps activation and
// marks the activation token redeemed.
//
// Guarantees:
//  * POST only — nothing here can be triggered by a link prefetcher, mail
//    scanner or browser preview. The token arrives in the request BODY only.
//  * Every input (names, brokerage, password policy, breach check) is
//    validated BEFORE the token is claimed, so a bad submission never
//    consumes the agent's link.
//  * This is NOT a single atomic transaction — Supabase Auth and Postgres are
//    separate systems. Ordering and recovery are therefore explicit:
//
//      validate            -> nothing claimed, link still usable
//      claim fails         -> caller gets the real state (+ resend handle)
//      signature bad       -> claim released, link still usable
//      profile save fails  -> claim released, link still usable, no password change
//      password set fails  -> claim released, link still usable, no password
//                             change. NOTE: the profile fields (first name,
//                             last name, brokerage) submitted on this attempt
//                             HAVE already been written. This is deliberate:
//                             they are exactly the values the agent just typed,
//                             they are overwritten by the next attempt, and
//                             they carry no lifecycle or authorization meaning
//                             (activation state lives in account_activated_at,
//                             agent_status and user_roles, none of which this
//                             step touches). Nothing here can grant access.
//      breach check down   -> 503 retry BEFORE any claim; password never
//                             accepted unscreened, link untouched
//      activation stamp    -> retried; on persistent failure we continue (the
//                             password IS set, so the agent must not be
//                             stranded) and the sign-in path re-stamps it
//      token complete      -> retried; on persistent failure the claim simply
//                             ages out after 5 minutes, and a replay then
//                             returns "ineligible" because the account is
//                             already activated
//      client never sees the response -> re-submitting returns "used" or
//                             "ineligible"; the caller signs in with the
//                             password it just set
//
//  * The plaintext password is never logged, never stored in any table and
//    never placed on a queue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  epochSeconds,
  newResendHandle,
  parseActivationToken,
  sha256Hex,
  verifyActivationToken,
} from "../_shared/activationTokens.ts";
import {
  checkPasswordBreach,
  validateActivationPassword,
} from "../_shared/activationPasswordPolicy.ts";

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

function cleanName(value: unknown, max = 80): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function retry<T>(label: string, fn: () => Promise<T | null>): Promise<T | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await fn();
      if (result !== null) return result;
    } catch (err) {
      console.warn(`[activation-complete] ${label} attempt ${attempt} threw:`, (err as Error).message);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 250 * attempt));
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ status: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SECRET = Deno.env.get("ACTIVATION_TOKEN_SECRET");
  if (!SUPABASE_URL || !SERVICE_KEY || !SECRET) {
    console.error("[activation-complete] missing configuration");
    return json({ status: "error" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ status: "invalid" }, 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const firstName = cleanName(body.firstName);
  const lastName = cleanName(body.lastName);
  const company = cleanName(body.company, 120);
  const password = typeof body.password === "string" ? body.password : "";

  // ---- Validation happens BEFORE the token is touched. ----
  const parsed = parseActivationToken(token);
  if (!parsed) return json({ status: "invalid" }, 400);
  if (!firstName || !lastName) {
    return json({ status: "validation", message: "Please enter your first and last name." }, 400);
  }
  if (!company) {
    return json({ status: "validation", message: "Please enter your brokerage." }, 400);
  }
  const policyError = validateActivationPassword(password);
  if (policyError) return json({ status: "validation", message: policyError }, 400);
  const breach = await checkPasswordBreach(password);
  if (breach === "breached") {
    return json({
      status: "validation",
      message: "That password has appeared in a known data breach. Please choose a different one.",
    }, 400);
  }
  if (breach === "unavailable") {
    // Fail closed: never accept a password we could not screen. Nothing has
    // been claimed or changed yet, so the activation link stays fully usable.
    return json({
      status: "retry",
      message: "We couldn't verify your password right now. Please try again in a moment.",
    }, 503);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const tokenHash = await sha256Hex(token);

  // ---- Atomic single-winner claim. ----
  const { data: claim, error: claimErr } = await admin.rpc("claim_agent_activation_token", {
    p_token_hash: tokenHash,
  });
  if (claimErr) {
    console.error("[activation-complete] claim failed:", claimErr.message);
    return json({ status: "error" }, 500);
  }

  const claimStatus = (claim as { status?: string } | null)?.status ?? "invalid";
  const tokenId = (claim as { token_id?: string } | null)?.token_id ?? null;

  if (claimStatus !== "claimed") {
    let handle: string | null = null;
    if (tokenId && RESEND_STATES.has(claimStatus)) {
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
    // "used" / "ineligible" may simply mean this exact submission already
    // succeeded and the response was lost. The caller retries sign-in.
    return json({ status: claimStatus, resendHandle: handle });
  }

  const userId = (claim as { user_id: string }).user_id;
  const release = async () => {
    try {
      await admin.rpc("release_agent_activation_token", { p_token_id: tokenId });
    } catch (err) {
      console.warn("[activation-complete] release failed:", (err as Error).message);
    }
  };

  // ---- Re-derive and verify the HMAC from the stored record. ----
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
    console.warn("[activation-complete] signature mismatch for token id", tokenId);
    return json({ status: "invalid" }, 400);
  }

  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
  const email = userRes?.user?.email;
  if (userErr || !email) {
    await release();
    console.error("[activation-complete] user lookup failed for token id", tokenId);
    return json({ status: "error" }, 500);
  }

  // ---- Profile first: retryable, no auth side effects. ----
  const { data: savedProfile, error: profileErr } = await admin
    .from("agent_profiles")
    .update({ first_name: firstName, last_name: lastName, company })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (profileErr || !savedProfile) {
    await release();
    console.error("[activation-complete] profile save failed:", profileErr?.message);
    return json({
      status: "retry",
      message: "We couldn't save your details. Please try again.",
    }, 500);
  }

  // ---- Password. Until this succeeds nothing about the account has changed. ----
  const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password });
  if (pwErr) {
    await release();
    const msg = (pwErr.message || "").toLowerCase();
    if (msg.includes("different from the old password") || msg.includes("same_password")) {
      return json({
        status: "validation",
        message: "Please choose a password different from your current one.",
      }, 400);
    }
    if (msg.includes("pwned") || msg.includes("weak") || msg.includes("breach")) {
      return json({
        status: "validation",
        message: "That password has appeared in a known data breach. Please choose a different one.",
      }, 400);
    }
    console.error("[activation-complete] password update failed for token id", tokenId);
    return json({
      status: "retry",
      message: "We couldn't set your password. Please try again.",
    }, 500);
  }

  // ---- Past this point the credentials work, so we never strand the agent. ----
  const stamped = await retry("mark_agent_activated", async () => {
    const { error } = await admin.rpc("mark_agent_activated", { _user_id: userId });
    return error ? null : true;
  });
  if (!stamped) {
    // Non-fatal: the sign-in path stamps activation as well.
    console.warn("[activation-complete] activation stamp incomplete for token id", tokenId);
  }

  const completed = await retry("complete_agent_activation_token", async () => {
    const { data, error } = await admin.rpc("complete_agent_activation_token", {
      p_token_id: tokenId,
    });
    return error ? null : (data === true ? true : false);
  });
  if (completed !== true) {
    // The claim ages out after 5 minutes; a replay then fails eligibility
    // because the account is already activated.
    console.warn("[activation-complete] token completion incomplete for token id", tokenId);
  }

  return json({ status: "ok", email });
});
