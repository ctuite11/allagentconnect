import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export async function assertDelegatesFeatureEnabled(
  admin: SupabaseClient,
  userId?: string,
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

  if (data?.enabled) return { ok: true };

  // Global flag off — check per-user allowlist if we have a userId
  if (userId) {
    const { data: allow, error: allowErr } = await admin
      .from("feature_flag_users")
      .select("user_id")
      .eq("flag_name", "agent_account_delegates")
      .eq("user_id", userId)
      .maybeSingle();

    if (allowErr) {
      console.error("[agent-delegates] allowlist lookup failed:", allowErr);
      return { ok: false, error: "Failed to check feature flag", status: 500 };
    }

    if (allow) return { ok: true };
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
