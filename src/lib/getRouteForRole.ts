import type { ResolvedRoleResult } from "@/lib/resolveUserRole";

/**
 * Deterministic router: one decision, one redirect, no retries.
 * Kept free of Supabase imports so unit tests can cover routing without a browser env.
 */
export function getRouteForRole(result: ResolvedRoleResult): string {
  switch (result.role) {
    case "admin":
      return "/admin/approvals";
    case "developer":
      return "/developer";
    case "delegate":
      return "/agent-dashboard";
    case "buyer":
      return "/client/dashboard";
    case "agent":
      return result.is_verified_agent || result.can_access_success_hub
        ? "/agent-dashboard"
        : "/pending-verification";
    default:
      return "/access-error";
  }
}
