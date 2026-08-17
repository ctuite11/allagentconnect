import type { ResolvedRole } from "@/lib/resolveUserRole";

type LegacyDashboardDecision =
  | { status: "loading" }
  | { status: "redirect"; target: string };

interface LegacyDashboardState {
  userPresent: boolean;
  role: ResolvedRole | null;
  loading: boolean;
}

/**
 * Pure routing decision for the legacy dashboard entry point.
 * An authenticated account with no resolved role must never be treated as
 * signed out; it belongs on the access-error page once resolution settles.
 */
export function decideLegacyDashboardRoute({
  userPresent,
  role,
  loading,
}: LegacyDashboardState): LegacyDashboardDecision {
  if (loading) return { status: "loading" };
  if (!userPresent) return { status: "redirect", target: "/auth" };

  switch (role) {
    case "admin":
      return { status: "redirect", target: "/admin/approvals" };
    case "developer":
      return { status: "redirect", target: "/developer" };
    case "agent":
    case "delegate":
      return { status: "redirect", target: "/agent-dashboard" };
    case "buyer":
      return { status: "redirect", target: "/client/dashboard" };
    default:
      return { status: "redirect", target: "/access-error" };
  }
}