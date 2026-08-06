import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { decideLegacyDashboardRoute } from "./legacyDashboardRoute";

describe("legacy dashboard auth routing", () => {
  it("waits while a newly signed-in user's role is resolving", () => {
    expect(
      decideLegacyDashboardRoute({ userPresent: true, role: null, loading: true }),
    ).toEqual({ status: "loading" });
  });

  it.each([
    ["admin", "/admin/approvals"],
    ["agent", "/agent-dashboard"],
    ["delegate", "/agent-dashboard"],
    ["buyer", "/client/dashboard"],
  ] as const)("routes %s accounts to %s", (role, target) => {
    expect(
      decideLegacyDashboardRoute({ userPresent: true, role, loading: false }),
    ).toEqual({ status: "redirect", target });
  });

  it("routes a genuinely signed-out visitor to login", () => {
    expect(
      decideLegacyDashboardRoute({ userPresent: false, role: null, loading: false }),
    ).toEqual({ status: "redirect", target: "/auth" });
  });

  it("does not send an authenticated unknown-role account back into login", () => {
    expect(
      decideLegacyDashboardRoute({ userPresent: true, role: null, loading: false }),
    ).toEqual({ status: "redirect", target: "/access-error" });
  });

  it("marks auth as loading before resolving a role after sign-in", () => {
    const provider = readFileSync("src/hooks/useAuthRole.tsx", "utf8");
    expect(provider).toMatch(
      /clearResolvedAccess\(\);\s*setLoading\(true\);\s*void loadRoleForUser\(newUser\.id, resolutionId\)/,
    );
  });
});