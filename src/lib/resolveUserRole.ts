import { supabase } from "@/integrations/supabase/client";

export type ResolvedRole = "admin" | "agent" | "buyer" | "unknown";

export interface ResolvedRoleResult {
  role: ResolvedRole;
  is_verified_agent: boolean;
}

/**
 * Single authoritative role resolver.
 * Calls the SECURITY DEFINER resolve_user_role RPC — one round-trip, no UI guessing.
 * Priority order (enforced server-side): admin > buyer > agent > unknown
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
  };
}

/**
 * Deterministic router: one decision, one redirect, no retries.
 * Returns the target path for a given resolved role.
 */
export function getRouteForRole(result: ResolvedRoleResult): string {
  switch (result.role) {
    case "admin":
      return "/admin/approvals";
    case "buyer":
      return "/client/dashboard";
    case "agent":
      return result.is_verified_agent ? "/agent-dashboard" : "/pending-verification";
    default:
      // /access-error prevents auth→unknown→auth bounce loops
      return "/access-error";
  }
}
