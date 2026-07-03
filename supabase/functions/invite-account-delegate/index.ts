/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";
import {
  assertDelegatesFeatureEnabled,
  isLicensedOwner,
  kickEmailQueue,
  resolveAuthUserEmail,
} from "../_shared/agentDelegatesGate.ts";
import { formatPersonDisplayName } from "../_shared/personDisplayName.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

type SupabaseAdmin = ReturnType<typeof createClient>;

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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ownerName, ownerBrokerage } = await loadOwnerInviteContext(supabaseAdmin, ownerUserId);
  const inviteLink = `${appUrl}/accept-delegate-invite?token=${inviteToken}`;
  const subject = `${ownerName} invited you to their All Agent Connect account`;

  const { error: emailErr } = await supabaseAdmin.from("email_jobs").insert({
    payload: {
      provider: "resend",
      template: "account-delegate-invite",
      to: inviteEmail,
      subject,
      variables: {
        ownerName,
        ownerBrokerage,
        roleLabel: roleLabel || "",
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

  const ownerUserId = user.id;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const flag = await assertDelegatesFeatureEnabled(supabaseAdmin, {
    userId: ownerUserId,
    ownerUserId,
  });
  if (!flag.ok) return json({ success: false, error: flag.error }, flag.status);

  if (!(await isLicensedOwner(supabaseAdmin, ownerUserId))) {
    return json({ success: false, error: "Only verified account owners can invite delegates" }, 403);
  }

  let input: { invite_email?: string; display_name?: string; role_label?: string };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const inviteEmail = input.invite_email?.trim().toLowerCase();
  if (!inviteEmail) {
    return json({ success: false, error: "invite_email is required" }, 400);
  }

  const ownerEmail = await resolveAuthUserEmail(supabaseAdmin, ownerUserId);
  if (ownerEmail && ownerEmail === inviteEmail) {
    return json({ success: false, error: "You cannot invite yourself as a delegate" }, 400);
  }

  const displayName = input.display_name?.trim() || null;
  const roleLabel = input.role_label?.trim() || null;

  const { data: pendingInvite } = await supabaseAdmin
    .from("agent_account_members")
    .select("id, invite_token, display_name, role_label, superseded_invite_tokens")
    .eq("owner_user_id", ownerUserId)
    .eq("invite_email", inviteEmail)
    .eq("status", "invited")
    .maybeSingle();

  if (pendingInvite) {
    const newToken = generateInviteToken();
    const supersededTokens = [
      ...(Array.isArray(pendingInvite.superseded_invite_tokens)
        ? pendingInvite.superseded_invite_tokens
        : []),
      pendingInvite.invite_token,
    ];
    const updatePayload: Record<string, unknown> = {
      invite_token: newToken,
      invite_expires_at: inviteExpiresAt(),
      invited_at: new Date().toISOString(),
      superseded_invite_tokens: supersededTokens,
    };

    if ("display_name" in input) updatePayload.display_name = displayName;
    if ("role_label" in input) updatePayload.role_label = roleLabel;

    const { data: updatedRow, error: updateErr } = await supabaseAdmin
      .from("agent_account_members")
      .update(updatePayload)
      .eq("id", pendingInvite.id)
      .select("id, invite_token, display_name, role_label")
      .single();

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
      inviteEmail,
      updatedRow.invite_token,
      updatedRow.display_name,
      updatedRow.role_label,
    );

    if (!emailResult.ok) {
      return json({ success: false, error: emailResult.error }, 500);
    }

    await logDelegateInviteAudit(supabaseAdmin, ownerUserId, updatedRow.id, "DELEGATE_INVITE_RESENT");

    return json({
      success: true,
      member_id: updatedRow.id,
      invite_email: inviteEmail,
      resent: true,
    });
  }

  const { data: acceptedMembership } = await supabaseAdmin
    .from("agent_account_members")
    .select("id, delegate_user_id")
    .eq("owner_user_id", ownerUserId)
    .eq("invite_email", inviteEmail)
    .eq("status", "accepted")
    .maybeSingle();

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
      invited_by: ownerUserId,
      invite_expires_at: inviteExpiresAt(),
    })
    .select("id, invite_token, display_name, role_label")
    .single();

  if (insertErr || !memberRow) {
    console.error("[invite-account-delegate] insert failed:", insertErr);
    if (insertErr?.code === "23505") {
      return json({ success: false, error: "This person has already been invited." }, 400);
    }
    return json({ success: false, error: "Failed to create invite" }, 500);
  }

  const emailResult = await enqueueDelegateInviteEmail(
    supabaseAdmin,
    supabaseUrl,
    serviceRoleKey,
    appUrl,
    ownerUserId,
    inviteEmail,
    memberRow.invite_token,
    memberRow.display_name,
    memberRow.role_label,
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
