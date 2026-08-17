import { supabase } from "@/integrations/supabase/client";

export type ResolvedRole =
  | "admin"
  | "agent"
  | "buyer"
  | "delegate"
  | "developer"
  | "unknown";

export type DelegateMembershipSummary = {
  owner_user_id: string;
  display_name: string | null;
  role_label: string | null;
};

/** Development companies from resolve_user_role (development_account_members). */
export type DeveloperAccountSummary = {
  account_id: string;
  name: string | null;
  slug: string | null;
  member_role: string | null;
  is_active: boolean | null;
};

export interface ResolvedRoleResult {
  role: ResolvedRole;
  is_verified_agent: boolean;
  is_licensed_owner?: boolean;
  is_delegate?: boolean;
  active_owner_user_id?: string | null;
  delegated_owner_user_id?: string | null;
  owner_display_name?: string | null;
  can_access_success_hub?: boolean;
  delegate_memberships?: DelegateMembershipSummary[];
  is_developer?: boolean;
  developer_accounts?: DeveloperAccountSummary[];
  developer_account_count?: number;
  primary_developer_account_id?: string | null;
}

/**
 * Single authoritative role resolver.
 * Calls the SECURITY DEFINER resolve_user_role RPC — one round-trip, no UI guessing.
 * Priority order (enforced server-side): admin > developer > verified agent > delegate > agent > buyer > unknown
 */
export async function resolveUserRole(userId: string): Promise<ResolvedRoleResult> {
  const { data, error } = await supabase.rpc("resolve_user_role", {
    _user_id: userId,
  });

  if (error) {
    console.error("[resolveUserRole] RPC error:", error.message);
    return { role: "unknown", is_verified_agent: false };
  }

  const result = data as unknown as ResolvedRoleResult | null;
  if (!result || !result.role) {
    return { role: "unknown", is_verified_agent: false };
  }

  return {
    role: result.role as ResolvedRole,
    is_verified_agent: result.is_verified_agent ?? false,
    is_licensed_owner: result.is_licensed_owner ?? false,
    is_delegate: result.is_delegate ?? result.role === "delegate",
    active_owner_user_id: result.active_owner_user_id ?? result.delegated_owner_user_id ?? null,
    delegated_owner_user_id: result.delegated_owner_user_id ?? null,
    owner_display_name: result.owner_display_name ?? null,
    can_access_success_hub: result.can_access_success_hub ?? false,
    delegate_memberships: result.delegate_memberships ?? [],
    is_developer: result.is_developer ?? result.role === "developer",
    developer_accounts: result.developer_accounts ?? [],
    developer_account_count: result.developer_account_count ?? 0,
    primary_developer_account_id: result.primary_developer_account_id ?? null,
  };
}

export { getRouteForRole } from "@/lib/getRouteForRole";
