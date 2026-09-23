import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export async function assertDelegatesFeatureEnabled(
  admin: SupabaseClient,
  options?: { userId?: string; ownerUserId?: string },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data, error } = await admin
    .from("feature_flags")
    .select("enabled")
    .eq("flag_name", "agent_account_delegates")
    .maybeSingle();

  if (error) {
    console.error("[agent-delegates] feature flag lookup failed:", error);
    return { ok: false, error: "Failed to check feature flag", status: 500 };
  }

  if (data?.enabled) {
    return { ok: true };
  }

  const userIds = [options?.userId, options?.ownerUserId].filter(Boolean) as string[];
  for (const userId of userIds) {
    const { data: allowed, error: allowErr } = await admin
      .from("feature_flag_users")
      .select("user_id")
      .eq("flag_name", "agent_account_delegates")
      .eq("user_id", userId)
      .maybeSingle();

    if (allowErr) {
      console.error("[agent-delegates] allowlist lookup failed:", allowErr);
      return { ok: false, error: "Failed to check feature flag", status: 500 };
    }

    if (allowed) {
      return { ok: true };
    }
  }

  return { ok: false, error: "delegates_disabled", status: 403 };
}

export async function isLicensedOwner(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("agent_settings")
    .select("agent_status")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.agent_status === "verified";
}

export async function isVerifiedLicensedAgent(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return isLicensedOwner(admin, userId);
}

export async function hasAgentRole(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "agent")
    .maybeSingle();

  return !!data;
}

export async function hasAdminRole(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return !!data;
}

/** Team lead, team_members.role=delegate, or platform admin. */
export async function canManageTeamAssistants(
  admin: SupabaseClient,
  teamId: string,
  userId: string,
): Promise<boolean> {
  if (await hasAdminRole(admin, userId)) return true;

  const { data: team } = await admin
    .from("teams")
    .select("id, team_lead_user_id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) return false;
  if (team.team_lead_user_id === userId) return true;

  const { data: membership } = await admin
    .from("team_members")
    .select("role, status")
    .eq("team_id", teamId)
    .eq("agent_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  return membership?.role === "lead" || membership?.role === "delegate";
}

export async function resolveTeamLeadUserId(
  admin: SupabaseClient,
  teamId: string,
): Promise<string | null> {
  const { data: team } = await admin
    .from("teams")
    .select("team_lead_user_id")
    .eq("id", teamId)
    .maybeSingle();

  if (team?.team_lead_user_id) return team.team_lead_user_id;

  const { data: lead } = await admin
    .from("team_members")
    .select("agent_id")
    .eq("team_id", teamId)
    .eq("role", "lead")
    .eq("status", "accepted")
    .maybeSingle();

  return lead?.agent_id ?? null;
}

export async function resolveAuthUserEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email?.trim().toLowerCase() ?? "";
}

export function kickEmailQueue(supabaseUrl: string, serviceRoleKey: string): void {
  void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }).catch((err) => {
    console.warn("[agent-delegates] kick-email-queue failed:", err);
  });
}
