/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";
import {
  assertDelegatesFeatureEnabled,
  canManageTeamAssistants,
  isLicensedOwner,
  kickEmailQueue,
  resolveAuthUserEmail,
  resolveTeamLeadUserId,
} from "../_shared/agentDelegatesGate.ts";
import { formatPersonDisplayName } from "../_shared/personDisplayName.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type SupabaseAdmin = ReturnType<typeof createClient>;

type PendingInviteRow = {
  id: string;
  invite_token: string;
  invite_email: string;
  display_name: string | null;
  role_label: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function inviteExpiresAt(): string {
  return new Date(Date.now() + INVITE_TTL_MS).toISOString();
}

async function loadOwnerInviteContext(supabaseAdmin: SupabaseAdmin, ownerUserId: string) {
  const { data: ownerProfile } = await supabaseAdmin
    .from("agent_profiles")
    .select("first_name, last_name, company")
    .eq("id", ownerUserId)
    .maybeSingle();

  const ownerName = formatPersonDisplayName(
    [ownerProfile?.first_name, ownerProfile?.last_name].filter(Boolean).join(" ") || "An agent",
  );

  return {
    ownerName,
    ownerBrokerage: ownerProfile?.company || "",
  };
}

async function enqueueDelegateInviteEmail(
  supabaseAdmin: SupabaseAdmin,
  supabaseUrl: string,
  serviceRoleKey: string,
  appUrl: string,
  ownerUserId: string,
  inviteEmail: string,
  inviteToken: string,
  displayName: string | null,
  roleLabel: string | null,
  isTeamInvite: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ownerName, ownerBrokerage } = await loadOwnerInviteContext(supabaseAdmin, ownerUserId);
  const inviteLink = `${appUrl}/accept-delegate-invite?token=${inviteToken}`;
  const subject = isTeamInvite
    ? `${ownerName} invited you to help manage their team on All Agent Connect`
    : `${ownerName} invited you to their All Agent Connect account`;

  const { error: emailErr } = await supabaseAdmin.from("email_jobs").insert({
    payload: {
      provider: "resend",
      template: "account-delegate-invite",
      to: inviteEmail,
      subject,
      variables: {
        ownerName,
        ownerBrokerage,
        roleLabel: roleLabel || (isTeamInvite ? "Team assistant" : ""),
        inviteeName: displayName || "",
        inviteLink,
      },
    },
  });

  if (emailErr) {
    console.error("[invite-account-delegate] email enqueue failed:", emailErr);
    return { ok: false, error: "Failed to send invite email" };
  }

  kickEmailQueue(supabaseUrl, serviceRoleKey);
  return { ok: true };
}

async function logDelegateInviteAudit(
  supabaseAdmin: SupabaseAdmin,
  ownerUserId: string,
  memberId: string,
  action: "DELEGATE_INVITE_SENT" | "DELEGATE_INVITE_RESENT",
): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    user_id: ownerUserId,
    action,
    table_name: "agent_account_members",
    record_id: memberId,
  });

  if (error) {
    console.error(`[invite-account-delegate] audit insert failed (${action}):`, error);
  }
}

async function loadSupersededTokens(
  supabaseAdmin: SupabaseAdmin,
  memberId: string,
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("agent_account_members")
    .select("superseded_invite_tokens")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    console.warn("[invite-account-delegate] superseded token lookup skipped:", error.message);
    return [];
  }

  return Array.isArray(data?.superseded_invite_tokens) ? data.superseded_invite_tokens : [];
}

async function findPendingInvite(
  supabaseAdmin: SupabaseAdmin,
  ownerUserId: string,
  opts: { memberId?: string; inviteEmail?: string; teamId?: string | null },
): Promise<PendingInviteRow | null> {
  const selectFields = "id, invite_token, invite_email, display_name, role_label";
  const teamId = opts.teamId ?? null;

  if (opts.memberId) {
    let query = supabaseAdmin
      .from("agent_account_members")
      .select(selectFields)
      .eq("id", opts.memberId)
      .eq("owner_user_id", ownerUserId)
      .eq("status", "invited");

    query = teamId ? query.eq("team_id", teamId) : query.is("team_id", null);

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("[invite-account-delegate] pending lookup by member_id failed:", error);
      return null;
    }
    return data as PendingInviteRow | null;
  }

  if (opts.inviteEmail) {
    let query = supabaseAdmin
      .from("agent_account_members")
      .select(selectFields)
      .eq("owner_user_id", ownerUserId)
      .eq("invite_email", opts.inviteEmail)
      .eq("status", "invited");

    query = teamId ? query.eq("team_id", teamId) : query.is("team_id", null);

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("[invite-account-delegate] pending lookup by email failed:", error);
      return null;
    }
    return data as PendingInviteRow | null;
  }

  return null;
}

async function resendPendingInvite(
  supabaseAdmin: SupabaseAdmin,
  supabaseUrl: string,
  serviceRoleKey: string,
  appUrl: string,
  ownerUserId: string,
  pendingInvite: PendingInviteRow,
  input: { display_name?: string; role_label?: string },
  isTeamInvite: boolean,
): Promise<Response> {
  const newToken = generateInviteToken();
  const supersededTokens = [
    ...(await loadSupersededTokens(supabaseAdmin, pendingInvite.id)),
    pendingInvite.invite_token,
  ];

  const displayName = "display_name" in input
    ? input.display_name?.trim() || null
    : pendingInvite.display_name;
  const roleLabel = "role_label" in input
    ? input.role_label?.trim() || null
    : pendingInvite.role_label;

  const updatePayload: Record<string, unknown> = {
    invite_token: newToken,
    invite_expires_at: inviteExpiresAt(),
    invited_at: new Date().toISOString(),
    superseded_invite_tokens: supersededTokens,
    display_name: displayName,
    role_label: roleLabel,
  };

  let { data: updatedRow, error: updateErr } = await supabaseAdmin
    .from("agent_account_members")
    .update(updatePayload)
    .eq("id", pendingInvite.id)
    .eq("owner_user_id", ownerUserId)
    .eq("status", "invited")
    .select("id, invite_token, display_name, role_label, invite_email")
    .single();

  if (updateErr?.message?.includes("superseded_invite_tokens")) {
    const { superseded_invite_tokens: _ignored, ...withoutSuperseded } = updatePayload;
    ({ data: updatedRow, error: updateErr } = await supabaseAdmin
      .from("agent_account_members")
      .update(withoutSuperseded)
      .eq("id", pendingInvite.id)
      .eq("owner_user_id", ownerUserId)
      .eq("status", "invited")
      .select("id, invite_token, display_name, role_label, invite_email")
      .single());
  }

  if (updateErr || !updatedRow) {
    console.error("[invite-account-delegate] resend update failed:", updateErr);
    return json({ success: false, error: "Failed to refresh invite" }, 500);
  }

  const emailResult = await enqueueDelegateInviteEmail(
    supabaseAdmin,
    supabaseUrl,
    serviceRoleKey,
    appUrl,
    ownerUserId,
    updatedRow.invite_email,
    updatedRow.invite_token,
    updatedRow.display_name,
    updatedRow.role_label,
    isTeamInvite,
  );

  if (!emailResult.ok) {
    return json({ success: false, error: emailResult.error }, 500);
  }

  await logDelegateInviteAudit(supabaseAdmin, ownerUserId, updatedRow.id, "DELEGATE_INVITE_RESENT");

  return json({
    success: true,
    member_id: updatedRow.id,
    invite_email: updatedRow.invite_email,
    resent: true,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = resolveEmailBaseUrl(
    Deno.env.get("EMAIL_BASE_URL") || Deno.env.get("APP_URL"),
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, error: "Missing auth token" }, 401);
  }

  const jwt = authHeader.replace("Bearer ", "");
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(jwt);
  if (userErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

  const callerId = user.id;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let input: {
    invite_email?: string;
    member_id?: string;
    display_name?: string;
    role_label?: string;
    team_id?: string;
  };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const teamId = input.team_id?.trim() || null;
  let ownerUserId: string;

  if (teamId) {
    if (!(await canManageTeamAssistants(supabaseAdmin, teamId, callerId))) {
      return json({ success: false, error: "Not authorized to manage team assistants" }, 403);
    }
    ownerUserId = (await resolveTeamLeadUserId(supabaseAdmin, teamId)) ?? callerId;
  } else {
    if (!(await isLicensedOwner(supabaseAdmin, callerId))) {
      return json({ success: false, error: "Only verified account owners can invite delegates" }, 403);
    }
    ownerUserId = callerId;
  }

  const flag = await assertDelegatesFeatureEnabled(supabaseAdmin, {
    userId: callerId,
    ownerUserId,
  });
  if (!flag.ok) return json({ success: false, error: flag.error }, flag.status);

  const memberId = input.member_id?.trim();
  const inviteEmail = input.invite_email?.trim().toLowerCase();
  if (!memberId && !inviteEmail) {
    return json({ success: false, error: "invite_email or member_id is required" }, 400);
  }

  if (inviteEmail) {
    const ownerEmail = await resolveAuthUserEmail(supabaseAdmin, ownerUserId);
    if (ownerEmail && ownerEmail === inviteEmail) {
      return json({ success: false, error: "You cannot invite yourself as a delegate" }, 400);
    }
  }

  const displayName = input.display_name?.trim() || null;
  const roleLabel = input.role_label?.trim() || null;
  const isTeamInvite = !!teamId;

  const pendingInvite = await findPendingInvite(supabaseAdmin, ownerUserId, {
    memberId,
    inviteEmail,
    teamId,
  });

  if (pendingInvite) {
    return await resendPendingInvite(
      supabaseAdmin,
      supabaseUrl,
      serviceRoleKey,
      appUrl,
      ownerUserId,
      pendingInvite,
      input,
      isTeamInvite,
    );
  }

  if (!inviteEmail) {
    return json({ success: false, error: "Pending invite not found for this member" }, 404);
  }

  let acceptedQuery = supabaseAdmin
    .from("agent_account_members")
    .select("id, delegate_user_id")
    .eq("owner_user_id", ownerUserId)
    .eq("invite_email", inviteEmail)
    .eq("status", "accepted");

  acceptedQuery = teamId
    ? acceptedQuery.eq("team_id", teamId)
    : acceptedQuery.is("team_id", null);

  const { data: acceptedMembership } = await acceptedQuery.maybeSingle();

  if (acceptedMembership) {
    return json({ success: false, error: "This person is already a delegate on your account." }, 400);
  }

  const { data: memberRow, error: insertErr } = await supabaseAdmin
    .from("agent_account_members")
    .insert({
      owner_user_id: ownerUserId,
      invite_email: inviteEmail,
      display_name: displayName,
      role_label: roleLabel,
      status: "invited",
      invited_by: callerId,
      invite_expires_at: inviteExpiresAt(),
      team_id: teamId,
    })
    .select("id, invite_token, display_name, role_label, invite_email")
    .single();

  if (insertErr || !memberRow) {
    console.error("[invite-account-delegate] insert failed:", insertErr);

    if (insertErr?.code === "23505") {
      const existingPending = await findPendingInvite(supabaseAdmin, ownerUserId, {
        inviteEmail,
        teamId,
      });
      if (existingPending) {
        return await resendPendingInvite(
          supabaseAdmin,
          supabaseUrl,
          serviceRoleKey,
          appUrl,
          ownerUserId,
          existingPending,
          input,
          isTeamInvite,
        );
      }
    }

    return json({ success: false, error: "Failed to create invite" }, 500);
  }

  const emailResult = await enqueueDelegateInviteEmail(
    supabaseAdmin,
    supabaseUrl,
    serviceRoleKey,
    appUrl,
    ownerUserId,
    memberRow.invite_email,
    memberRow.invite_token,
    memberRow.display_name,
    memberRow.role_label,
    isTeamInvite,
  );

  if (emailResult.ok) {
    await logDelegateInviteAudit(supabaseAdmin, ownerUserId, memberRow.id, "DELEGATE_INVITE_SENT");
    return json({
      success: true,
      member_id: memberRow.id,
      invite_email: inviteEmail,
      resent: false,
    });
  }

  await supabaseAdmin.from("agent_account_members").delete().eq("id", memberRow.id);
  return json({ success: false, error: emailResult.error }, 500);
});
