import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { DEVELOPER_ACCESS_UI_ENABLED } from "@/config/featureFlags";
import RequestAccessPage from "@/pages/RequestAccessPage";

describe("Developer access prelaunch gate", () => {
  it("keeps the single launch switch off", () => {
    expect(DEVELOPER_ACCESS_UI_ENABLED).toBe(false);
  });

  it("shows Agent request access without exposing Developer access", () => {
    const html = renderToStaticMarkup(
      <HelmetProvider>
        <MemoryRouter>
          <RequestAccessPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(html).toContain("Request Agent Access");
    expect(html).not.toMatch(/Request Developer Access|Developer portal/);
  });

  it("gates request, sign-in, and the private workspace with the same flag", () => {
    const appSource = readFileSync("src/App.tsx", "utf8");

    expect(appSource).toContain('path="/developer-access" element={DEVELOPER_ACCESS_UI_ENABLED');
    expect(appSource).toContain('path="/developer-login" element={DEVELOPER_ACCESS_UI_ENABLED');
    expect(appSource).toContain('element={DEVELOPER_ACCESS_UI_ENABLED ? <DeveloperLayout />');
  });
});