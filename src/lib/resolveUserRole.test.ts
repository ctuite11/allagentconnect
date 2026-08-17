import { describe, expect, it } from "vitest";
import { getRouteForRole } from "./getRouteForRole";
import type { ResolvedRoleResult } from "./resolveUserRole";

function base(partial: Partial<ResolvedRoleResult>): ResolvedRoleResult {
  return {
    role: "unknown",
    is_verified_agent: false,
    ...partial,
  };
}

describe("getRouteForRole", () => {
  it("routes developer accounts to the developer portal", () => {
    expect(getRouteForRole(base({ role: "developer" }))).toBe("/developer");
  });

  it("never sends developers to Success Hub or pending verification", () => {
    expect(
      getRouteForRole(base({ role: "developer", is_verified_agent: false })),
    ).toBe("/developer");
  });

  it("keeps existing agent/admin/buyer routes", () => {
    expect(getRouteForRole(base({ role: "admin" }))).toBe("/admin/approvals");
    expect(getRouteForRole(base({ role: "buyer" }))).toBe("/client/dashboard");
    expect(
      getRouteForRole(base({ role: "agent", is_verified_agent: true })),
    ).toBe("/agent-dashboard");
    expect(
      getRouteForRole(base({ role: "agent", is_verified_agent: false })),
    ).toBe("/pending-verification");
  });
});
