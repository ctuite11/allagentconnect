/**
 * Verify fixed rail pinning on PropertyDetail (requires agent session) or reports layout facts.
 *   node scripts/diagnose-sticky-rail.mjs [listingId] [port]
 */
import { chromium } from "playwright";

const listingId = process.argv[2] ?? "f5aace9a-d002-4101-a42f-9505c1947362";
const port = process.argv[3] ?? "5173";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await page.goto(`http://127.0.0.1:${port}/property/${listingId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(5000);

  const report = await page.evaluate(() => {
    const pathname = window.location.pathname;
    const isAgentGrid = !!document.querySelector('[class*="grid-cols-[minmax"]');
    const isConsumerHero = !!document.querySelector(".lg\\:flex-row");

    const rail =
      [...document.querySelectorAll("div")].find(
        (el) =>
          el.textContent?.includes("Listing Agent") ||
          el.textContent?.includes("Listing agent"),
      ) ?? null;

    let panel = rail;
    while (panel && getComputedStyle(panel).position !== "fixed" && getComputedStyle(panel).position !== "sticky") {
      if (panel.parentElement?.textContent?.includes("Listing")) {
        panel = panel.parentElement;
      } else break;
    }

    const stickyOrFixed = panel ? getComputedStyle(panel).position : null;
    const scrollY0 = window.scrollY;
    window.scrollTo(0, 1400);
    const topAfterScroll = panel?.getBoundingClientRect().top ?? null;
    window.scrollTo(0, scrollY0);

    const anchor = panel?.parentElement;
    return {
      pathname,
      isAgentGrid,
      isConsumerHero,
      panelPosition: stickyOrFixed,
      panelTopCss: panel ? getComputedStyle(panel).top : null,
      anchorHeight: anchor?.getBoundingClientRect().height ?? null,
      topAfterScroll1400: topAfterScroll,
      pinned: topAfterScroll !== null && topAfterScroll <= 32,
      pageScrollHeight: document.documentElement.scrollHeight,
    };
  });

  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
