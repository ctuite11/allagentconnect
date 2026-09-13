// @auth-classification: admin-jwt
//
// Admin -> "Copy setup link".
//
// Issues an AAC-owned 30-day link and returns it to the calling admin. No
// email is sent or queued by this function: it calls the dedicated *_no_email
// issuance RPCs, which create the token row without an email_jobs row.
//
// Link selection uses AAC's canonical activation state,
// `agent_settings.account_activated_at` — the same field
// `agent_is_activation_eligible()` checks. `auth.users.last_sign_in_at` is
// deliberately NOT consulted.
//
//   account_activated_at IS NULL  -> activation/setup link  /activate#t=...
//   account_activated_at IS NOT NULL -> sign-in link        /signin-link#t=...
//
// The plaintext token never leaves this function and is never persisted; the
// database stores only sha256(token).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { AAC_PUBLIC_URL } from "../_shared/aacPublicUrl.ts";
import {
  ACTIVATION_TOKEN_TTL_DAYS,
  activationUrl,
  sha256Hex,
  signActivationToken,
} from "../_shared/activationTokens.ts";
import {
  LOGIN_TOKEN_TTL_DAYS,
  loginLinkUrl,
  sha256Hex as sha256HexLogin,
  signLoginToken,
} from "../_shared/loginTokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BodyInput {
  userId?: string;
  email?: string;
  acknowledgeDeleted?: boolean;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Shared TTL for every AAC account-access link. */
function expiryFromNow(days: number): Date {
  return new Date(Math.floor(Date.now() / 1000) * 1000 + days * 24 * 60 * 60 * 1000);
}

const ISSUANCE_REASONS: Record<string, string> = {
  ineligible:
    "This agent is not eligible for a setup link (not verified, rejected, or removed).",
  blocked: "A setup link for this agent is being redeemed right now. Try again in a few minutes.",
  no_recipient: "This agent has no valid email address on file.",
  deduped: "A setup link was just generated for this agent. Try again in a minute.",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const secret = Deno.env.get("ACTIVATION_TOKEN_SECRET");
    if (!supabaseUrl || !serviceKey || !secret) {
      console.error("[generate-agent-setup-link] missing configuration");
      return json(500, { error: "Server misconfigured" });
    }

    // ── Admin gate: require an authenticated admin caller. ──────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { error: "Unauthorized" });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) return json(401, { error: "Unauthorized" });

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: caller.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json(403, { error: "Forbidden" });

    // ── Resolve target email + auth user id ─────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as BodyInput;
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    let userId = typeof body.userId === "string" && UUID_RE.test(body.userId.trim())
      ? body.userId.trim()
      : "";

    if (userId) {
      const { data: u } = await admin.auth.admin.getUserById(userId);
      const authEmail = u?.user?.email?.trim().toLowerCase() ?? "";
      if (!authEmail) {
        // The id was a profile-only / pending row, not an auth user.
        userId = "";
      } else {
        email = authEmail;
      }
    }

    if (!userId && email) {
      const { data: profile } = await admin
        .from("agent_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (profile?.id) {
        const { data: u } = await admin.auth.admin.getUserById(profile.id);
        if (u?.user?.id) {
          userId = u.user.id;
          email = u.user.email?.trim().toLowerCase() ?? email;
        }
      }
    }

    if (!email || !email.includes("@")) {
      return json(400, { error: "Could not resolve agent email" });
    }
    if (!userId) {
      return json(404, {
        error: "This agent has no account yet — verify them first to create one.",
      });
    }

    // ── Canonical activation state (NOT last_sign_in_at) ────────────────────
    const { data: settings, error: settingsErr } = await admin
      .from("agent_settings")
      .select("account_activated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (settingsErr) {
      console.error("[generate-agent-setup-link] settings lookup failed");
      return json(500, { error: "Could not read account state" });
    }
    const isActivated = !!settings?.account_activated_at;

    const acknowledgeDeleted = body.acknowledgeDeleted === true;
    const tokenId = crypto.randomUUID();

    let setupUrl: string;
    let tokenType: "activation" | "login";
    let expiresAt: Date;
    let result: unknown;

    if (!isActivated) {
      tokenType = "activation";
      expiresAt = expiryFromNow(ACTIVATION_TOKEN_TTL_DAYS);
      const plaintext = await signActivationToken(secret, {
        id: tokenId,
        userId,
        expiresAtEpoch: Math.floor(expiresAt.getTime() / 1000),
      });
      const { data, error } = await admin.rpc("issue_agent_activation_token_no_email", {
        p_id: tokenId,
        p_user_id: userId,
        p_token_hash: await sha256Hex(plaintext),
        p_expires_at: expiresAt.toISOString(),
        p_allow_previously_deleted: acknowledgeDeleted,
      });
      if (error) {
        console.error("[generate-agent-setup-link] activation issuance failed:", error.message);
        return json(500, { error: "Failed to generate setup link" });
      }
      result = data;
      setupUrl = activationUrl(AAC_PUBLIC_URL, plaintext);
    } else {
      tokenType = "login";
      expiresAt = expiryFromNow(LOGIN_TOKEN_TTL_DAYS);
      const plaintext = await signLoginToken(secret, {
        id: tokenId,
        userId,
        expiresAtEpoch: Math.floor(expiresAt.getTime() / 1000),
      });
      const { data, error } = await admin.rpc("issue_agent_login_token_no_email", {
        p_id: tokenId,
        p_user_id: userId,
        p_token_hash: await sha256HexLogin(plaintext),
        p_expires_at: expiresAt.toISOString(),
      });
      if (error) {
        console.error("[generate-agent-setup-link] login issuance failed:", error.message);
        return json(500, { error: "Failed to generate setup link" });
      }
      result = data;
      setupUrl = loginLinkUrl(AAC_PUBLIC_URL, plaintext);
    }

    const status = (result as { status?: string } | null)?.status ?? "unknown";
    if (status !== "created") {
      return json(422, {
        status,
        error: ISSUANCE_REASONS[status] ?? `Could not generate setup link (${status}).`,
      });
    }

    // IMPORTANT: never log the setup URL or the token.
    return json(200, {
      setupUrl,
      email,
      tokenType,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[generate-agent-setup-link] error:", (err as Error).message);
    return json(500, { error: "Unexpected error" });
  }
});
