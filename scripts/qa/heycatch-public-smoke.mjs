import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });

const routes = [
  { path: "/", heading: /ONE NETWORK\./, footer: true },
  { path: "/about", heading: /About All Agent Connect/, footer: true },
  { path: "/faq", heading: /Frequently asked questions/, footer: true },
  { path: "/off-market-listing-network", heading: /An off-market listing network/, footer: true },
  { path: "/privacy", heading: /Privacy Policy/, footer: true },
  { path: "/terms", heading: /Terms of Service/, footer: true },
  { path: "/agent-rules", heading: /Agent Network Rules/, footer: true },
  { path: "/fair-housing", heading: /Fair Housing/, footer: true },
  { path: "/cookies", heading: /Cookie Policy/, footer: true },
  { path: "/disclosures", heading: /Disclosures/, footer: true },
  { path: "/request-access", heading: /Request Access/, footer: false },
];

try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.on("pageerror", error => process.stderr.write("BROWSER ERROR: " + error.message + "\\n"));
  for (const { path, heading, footer } of routes) {
    process.stdout.write("CHECKING " + path + "\\n");
    const response = await page.goto(baseUrl + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert.equal(response?.status(), 200, path + " did not respond with 200");
    await page.getByRole("heading", { name: heading }).first().waitFor({ timeout: 25000 });
    if (path === "/") {
      await page.getByLabel("All Agent Connect active member count")
        .getByText("347 active AAC members").waitFor({ timeout: 25000 });
      await page.getByRole("link", { name: "See how membership works" }).waitFor({ timeout: 25000 });
      assert.equal(await page.getByRole("link", { name: /Sharing listings across brokerages may trigger MLS/i }).count(), 0,
        "Compliance text should stay in FAQ/rules, not the hero");
    }
    if (footer) {
      const foot = page.locator("footer");
      await foot.getByRole("link", { name: "About & founder" }).waitFor({ timeout: 25000 });
      assert.equal(await foot.locator('a[href="/our-agents"]').count(), 0, "Public agent-directory link must not be in footer");
      assert.equal(await foot.locator('a[href="/browse"]').count(), 0, "Public browse link must not be in footer");
      assert.equal(await foot.getByRole("link", { name: "Frequently asked questions" }).count(), 1);
    }
    assert.equal(await page.locator('img[src*="randomuser.me"]').count(), 0, "Placeholder member portraits must not appear");
    process.stdout.write("PASS desktop " + path + "\n");
  }

  for (const sectionId of ["how-it-works", "member-preview"]) {
    await page.goto(baseUrl + "/#" + sectionId, { waitUntil: "domcontentloaded" });
    await page.locator("#" + sectionId).waitFor({ timeout: 25000 });
    await page.waitForFunction(() => window.scrollY > 100, null, { timeout: 10000 });
    process.stdout.write("PASS lazy footer anchor #" + sectionId + "\n");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/faq", "/about"]) {
    await page.goto(baseUrl + path, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ timeout: 25000 });
    await page.locator("h1").first().scrollIntoViewIfNeeded();
    process.stdout.write("PASS mobile " + path + "\n");
  }

  await page.close();
} finally {
  await browser.close();
}
