import { defineConfig, devices } from "@playwright/test";
import { baseURL, loadE2EEnv } from "./e2e/helpers/authHarness";

loadE2EEnv();

/**
 * Auth-routing verification config.
 * Independent of the Lovable playwright package (not always installed).
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /auth-routing.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/playwright-report" }]],
  outputDir: "e2e/test-results",
  use: {
    baseURL: baseURL(),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
