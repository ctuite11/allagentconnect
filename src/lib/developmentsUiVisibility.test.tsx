import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEVELOPMENTS_UI_ENABLED } from "@/config/featureFlags";

describe("Developments prelaunch UI gate", () => {
  it("keeps the single launch switch off", () => {
    expect(DEVELOPMENTS_UI_ENABLED).toBe(false);
  });

  it("filters Developments from the agent sidebar while keeping the entry in code", () => {
    const source = readFileSync(
      "src/components/agent-dashboard-v2/DashboardSidebar.tsx",
      "utf8",
    );

    // The menu entry stays defined so launch is only a flag flip.
    expect(source).toContain('{ label: "Developments", icon: Building2, route: "/developments" }');
    // Both desktop and mobile drawers render from the filtered mainMenu list.
    expect(source).toContain('DEVELOPMENTS_UI_ENABLED || item.route !== "/developments"');
    expect(source).toContain("mainMenu.map((item)");
  });

  it("leaves the Developments routes registered", () => {
    const appSource = readFileSync("src/App.tsx", "utf8");

    expect(appSource).toContain('path="/developments"');
    expect(appSource).toContain('path="/developments/:slug"');
  });
});
