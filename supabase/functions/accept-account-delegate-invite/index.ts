/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  assertDelegatesFeatureEnabled,
  isVerifiedLicensedAgent,
} from "../_shared/agentDelegatesGate.ts";
import { formatPersonDisplayName } from "../_shared/personDisplayName.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LICENSED_AGENT_BLOCK_MESSAGE =
  "This email already belongs to a licensed AAC agent. Delegate access for existing agents is coming soon.";

type RequestBody = {
  token?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  existingAccount?: boolean;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  const target = normalizeEmail(email);
  try {
    const { data, error } = await admin
      .schema("auth" as never)
      .from("users" as never)
      .select("id, email")
      .ilike("email", target)
      .limit(1)
      .maybeSingle();
    if (!error && data && (data as { id: string }).id) {
      return data as { id: string; email: string };
    }
  } catch {
    // fall through
  }

  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => normalizeEmail(u.email ?? "") === target);
    if (match) return match;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function loadOwnerDisplayName(
  admin: SupabaseClient,
  ownerUserId: string,
): Promise<string> {
  const { data: ownerProfile } = await admin
    .from("agent_profiles")
    .select("first_name, last_name")
    .eq("id", ownerUserId)
    .maybeSingle();

  return formatPersonDisplayName(
    [ownerProfile?.first_name, ownerProfile?.last_name].filter(Boolean).join(" ") ||
      "the account owner",
  );
}

async function upsertMinimalProfile(
  admin: SupabaseClient,
  userId: string,
  email: string,
  firstName: string,
  lastName: string,
) {
  const payload = {
    email,
    first_name: firstName || null,
    last_name: lastName || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile?.id) {
    const { error } = await admin.from("profiles").update(payload).eq("id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("profiles").insert({ id: userId, ...payload });
  if (error) throw error;
}

async function setOwnerContext(
  admin: SupabaseClient,
  delegateUserId: string,
  ownerUserId: string,
) {
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("agent_active_context").upsert(
    {
      user_id: delegateUserId,
      active_owner_user_id: ownerUserId,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

async function ensureDelegateFeatureAllowlist(
  admin: SupabaseClient,
  delegateUserId: string,
): Promise<void> {
  const { data: flag } = await admin
    .from("feature_flags")
    .select("enabled")
    .eq("flag_name", "agent_account_delegates")
    .maybeSingle();

  if (flag?.enabled) return;

  const { error } = await admin.from("feature_flag_users").upsert(
    {
      flag_name: "agent_account_delegates",
      user_id: delegateUserId,
      note: "Auto-allowlisted on delegate invite accept",
    },
    { onConflict: "flag_name,user_id" },
  );

  if (error) {
    console.error("[accept-account-delegate-invite] allowlist upsert failed:", error);
  }
}

type AuthSessionTokens = {
  access_token: string;
  refresh_token: string;
};

async function signInAndGetSession(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
  opts?: { retries?: number },
): Promise<{ ok: true; session: AuthSessionTokens } | { ok: false; error: string }> {
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const maxAttempts = Math.max(1, opts?.retries ?? 1);
  let lastError = "Failed to sign in";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }

    const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
    if (data.session?.access_token && data.session.refresh_token) {
      return {
        ok: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
      };
    }

    lastError = error?.message || lastError;
    const lower = lastError.toLowerCase();
    if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
      break;
    }
  }

  console.error("[accept-account-delegate-invite] signIn failed:", lastError);
  return { ok: false, error: lastError };
}

async function buildSuccessResponse(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
  ownerUserId: string,
  ownerName: string,
  userId: string,
  extras?: { alreadyAccepted?: boolean; signInRetries?: number },
) {
  const signIn = await signInAndGetSession(supabaseUrl, anonKey, email, password, {
    retries: extras?.signInRetries ?? 3,
  });

  if (!signIn.ok) {
    return json({
      success: false,
      error:
        "Your account is ready, but we could not sign you in automatically. Try signing in from the login page.",
      code: "session_failed",
    }, 500);
  }

  return json({
    success: true,
    owner_user_id: ownerUserId,
    owner_display_name: ownerName,
    userId,
    session: signIn.session,
    alreadyAccepted: extras?.alreadyAccepted === true,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const inviteToken = body.token?.trim();
  const email = body.email ? normalizeEmail(body.email) : "";
  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const password = body.password ?? "";
  const existingAccount = body.existingAccount === true;

  if (!inviteToken) return json({ success: false, error: "token is required" }, 400);
  if (!email) return json({ success: false, error: "email is required" }, 400);
  if (!password || password.length < 8) {
    return json({ success: false, error: "Password must be at least 8 characters" }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const SUPERSEDED_INVITE_MESSAGE =
    "This invitation has been replaced by a newer one. Please use the most recent email invitation.";

  const { data: invite, error: inviteErr } = await supabaseAdmin
    .from("agent_account_members")
    .select(
      "id, owner_user_id, delegate_user_id, invite_email, display_name, status, invite_expires_at, accepted_at, team_id",
    )
    .eq("invite_token", inviteToken)
    .maybeSingle();

  if (inviteErr || !invite) {
    const { data: supersededRow } = await supabaseAdmin
      .from("agent_account_members")
      .select("id")
      .contains("superseded_invite_tokens", [inviteToken])
      .maybeSingle();

    if (supersededRow) {
      return json({
        success: false,
        error: SUPERSEDED_INVITE_MESSAGE,
        code: "superseded",
      }, 400);
    }

    return json({ success: false, error: "Invalid invite token" }, 400);
  }

  const flag = await assertDelegatesFeatureEnabled(supabaseAdmin, {
    ownerUserId: invite.owner_user_id,
  });
  if (!flag.ok) return json({ success: false, error: flag.error }, flag.status);

  if (email !== invite.invite_email.toLowerCase()) {
    return json({ success: false, error: "Email does not match this invitation" }, 403);
  }

  if (invite.status === "revoked") {
    return json({ success: false, error: "This invite is no longer valid" }, 400);
  }

  if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
    return json({ success: false, error: "This invite has expired" }, 400);
  }

  if (invite.status === "accepted") {
    if (invite.delegate_user_id) {
      const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
      if (existingUser?.id === invite.delegate_user_id) {
        const ownerName = await loadOwnerDisplayName(supabaseAdmin, invite.owner_user_id);
        // Team assistants must not get personal account impersonation context.
        if (!invite.team_id) {
          await setOwnerContext(supabaseAdmin, existingUser.id, invite.owner_user_id);
        }
        await ensureDelegateFeatureAllowlist(supabaseAdmin, existingUser.id);
        return await buildSuccessResponse(
          supabaseUrl,
          anonKey,
          email,
          password,
          invite.owner_user_id,
          ownerName,
          existingUser.id,
          { alreadyAccepted: true },
        );
      }
    }
    return json({ success: false, error: "This invite has already been accepted" }, 400);
  }

  if (invite.status !== "invited") {
    return json({ success: false, error: "Invalid invite status" }, 400);
  }

  let userId: string;
  const authUser = await findAuthUserByEmail(supabaseAdmin, email);

  if (authUser) {
    if (!existingAccount) {
      return json({
        success: false,
        error: "An account already exists for this email. Sign in to accept.",
        code: "existing_account",
      }, 409);
    }

    if (await isVerifiedLicensedAgent(supabaseAdmin, authUser.id)) {
      return json({
        success: false,
        error: LICENSED_AGENT_BLOCK_MESSAGE,
        code: "licensed_agent_blocked",
      }, 403);
    }

    const passwordCheck = await signInAndGetSession(supabaseUrl, anonKey, email, password);
    if (!passwordCheck.ok) {
      return json({ success: false, error: "Invalid password" }, 401);
    }

    userId = authUser.id;

    const inviteeFlag = await assertDelegatesFeatureEnabled(supabaseAdmin, {
      userId,
      ownerUserId: invite.owner_user_id,
    });
    if (!inviteeFlag.ok) return json({ success: false, error: inviteeFlag.error }, inviteeFlag.status);
  } else {
    if (existingAccount) {
      return json({
        success: false,
        error: "No account exists for this email. Create a password instead.",
        code: "account_missing",
      }, 404);
    }

    if (!firstName || !lastName) {
      return json({ success: false, error: "First and last name are required" }, 400);
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        intended_role: "delegate",
      },
    });

    if (createError || !created?.user) {
      const msg = createError?.message ?? "Failed to create account";
      if (msg.toLowerCase().includes("already")) {
        return json({
          success: false,
          error: "An account already exists for this email. Sign in to accept.",
          code: "existing_account",
        }, 409);
      }
      console.error("[accept-account-delegate-invite] create user failed:", createError);
      return json({ success: false, error: msg }, 500);
    }

    userId = created.user.id;

    const inviteeFlag = await assertDelegatesFeatureEnabled(supabaseAdmin, {
      userId,
      ownerUserId: invite.owner_user_id,
    });
    if (!inviteeFlag.ok) return json({ success: false, error: inviteeFlag.error }, inviteeFlag.status);

    try {
      await upsertMinimalProfile(
        supabaseAdmin,
        userId,
        email,
        firstName,
        lastName,
      );
    } catch (profileErr) {
      console.error("[accept-account-delegate-invite] profile upsert failed:", profileErr);
      return json({ success: false, error: "Failed to create user profile" }, 500);
    }
  }

  if (invite.owner_user_id === userId) {
    return json({ success: false, error: "Account owners cannot accept their own delegate invite" }, 400);
  }

  let otherMembershipQuery = supabaseAdmin
    .from("agent_account_members")
    .select("id")
    .eq("delegate_user_id", userId)
    .eq("status", "accepted")
    .neq("id", invite.id);

  // Personal: conflict only with other personal accepted rows.
  // Team-scoped: conflict only with other accepted rows for the same team.
  otherMembershipQuery = invite.team_id
    ? otherMembershipQuery.eq("team_id", invite.team_id)
    : otherMembershipQuery.is("team_id", null);

  const { data: otherMembership } = await otherMembershipQuery.maybeSingle();

  if (otherMembership) {
    return json({
      success: false,
      error: "You already have delegate access to another account.",
      code: "single_owner_only",
    }, 400);
  }

  const { error: updateErr } = await supabaseAdmin
    .from("agent_account_members")
    .update({
      status: "accepted",
      delegate_user_id: userId,
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id)
    .eq("status", "invited");

  if (updateErr) {
    console.error("[accept-account-delegate-invite] update failed:", updateErr);
    return json({ success: false, error: "Failed to accept invite" }, 500);
  }

  try {
    // Team assistants must not get personal account impersonation context.
    if (!invite.team_id) {
      await setOwnerContext(supabaseAdmin, userId, invite.owner_user_id);
    }
    await ensureDelegateFeatureAllowlist(supabaseAdmin, userId);
  } catch (ctxErr) {
    console.error("[accept-account-delegate-invite] context set failed:", ctxErr);
    return json({ success: false, error: "Failed to set account context" }, 500);
  }

  const ownerName = await loadOwnerDisplayName(supabaseAdmin, invite.owner_user_id);

  return await buildSuccessResponse(
    supabaseUrl,
    anonKey,
    email,
    password,
    invite.owner_user_id,
    ownerName,
    userId,
  );
});
