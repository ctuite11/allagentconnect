import { type BrowserContext, type ConsoleMessage, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export type RedirectTrace = {
  startingUrl: string;
  redirects: string[];
  finalUrl: string;
  consoleErrors: string[];
  resolveUserRoleFailures: string[];
  accessErrorSeen: boolean;
  accessErrorUrls: string[];
};

export type AccountCreds = {
  email: string;
  password: string;
  label: string;
};

function loadDotEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

export function loadE2EEnv() {
  loadDotEnvFile(path.resolve(process.cwd(), "e2e/.env"));
  loadDotEnvFile(path.resolve(process.cwd(), ".env.e2e"));
}

export function baseURL(): string {
  loadE2EEnv();
  return (process.env.E2E_BASE_URL || "https://splendid-gaufre-49195f.netlify.app").replace(
    /\/$/,
    "",
  );
}

export function requireAccount(
  emailKey: string,
  passwordKey: string,
  label: string,
): AccountCreds | null {
  loadE2EEnv();
  const email = process.env[emailKey]?.trim();
  const password = process.env[passwordKey]?.trim();
  if (!email || !password) return null;
  return { email, password, label };
}

export async function hardResetBrowserState(page: Page, context: BrowserContext) {
  // Best-effort app sign-out first (may no-op when already signed out).
  try {
    await page.goto(`${baseURL()}/auth?logout=1`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(500);
  } catch {
    /* continue with storage wipe */
  }

  await context.clearCookies();
  await page.goto(`${baseURL()}/auth`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await context.clearCookies();
}

export function attachRoutingTrace(page: Page): {
  getTrace: (startingUrl: string) => RedirectTrace;
  stop: () => void;
} {
  const redirects: string[] = [];
  const consoleErrors: string[] = [];
  const resolveUserRoleFailures: string[] = [];
  const accessErrorUrls: string[] = [];
  let accessErrorSeen = false;

  const onFrame = () => {
    const url = page.url();
    if (!redirects.length || redirects[redirects.length - 1] !== url) {
      redirects.push(url);
    }
    try {
      const u = new URL(url);
      if (u.pathname === "/access-error" || u.pathname.endsWith("/access-error")) {
        accessErrorSeen = true;
        accessErrorUrls.push(url);
      }
    } catch {
      /* ignore */
    }
  };

  const onConsole = (msg: ConsoleMessage) => {
    const text = msg.text();
    if (msg.type() === "error") {
      consoleErrors.push(text);
    }
    if (/resolveUserRole/i.test(text) && /(error|fail)/i.test(text)) {
      resolveUserRoleFailures.push(text);
    }
    if (/\[resolveUserRole\] RPC error/i.test(text)) {
      resolveUserRoleFailures.push(text);
    }
  };

  page.on("framenavigated", onFrame);
  page.on("console", onConsole);

  // Poll pathname briefly so a flash of /access-error is caught even if
  // framenavigated coalesces replaceState navigations.
  const poll = setInterval(() => {
    void page
      .evaluate(() => window.location.pathname + window.location.search + window.location.hash)
      .then((pathWithSearch) => {
        if (pathWithSearch.includes("/access-error")) {
          accessErrorSeen = true;
          const full = page.url();
          if (!accessErrorUrls.includes(full)) accessErrorUrls.push(full);
        }
        const full = page.url();
        if (!redirects.length || redirects[redirects.length - 1] !== full) {
          redirects.push(full);
        }
      })
      .catch(() => {
        /* page may be closed */
      });
  }, 50);

  return {
    getTrace(startingUrl: string): RedirectTrace {
      return {
        startingUrl,
        redirects: [...redirects],
        finalUrl: page.url(),
        consoleErrors: [...consoleErrors],
        resolveUserRoleFailures: [...resolveUserRoleFailures],
        accessErrorSeen,
        accessErrorUrls: [...accessErrorUrls],
      };
    },
    stop() {
      clearInterval(poll);
      page.off("framenavigated", onFrame);
      page.off("console", onConsole);
    },
  };
}

export async function signInOnAuthPage(page: Page, account: AccountCreds) {
  await page.goto(`${baseURL()}/auth`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // If Welcome Back interstitial appears for a stale session, force sign-out CTA.
  const signOutBtn = page.getByRole("button", { name: /sign out/i });
  if (await signOutBtn.isVisible().catch(() => false)) {
    await signOutBtn.click();
    await page.waitForTimeout(800);
  }

  await page.locator("#email, input[type='email']").first().fill(account.email);
  await page.locator("input[type='password']").first().fill(account.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

export async function waitForSettledPath(
  page: Page,
  predicate: (pathname: string) => boolean,
  timeoutMs = 45_000,
) {
  await page.waitForFunction(
    (forbidden) => {
      const p = window.location.pathname;
      // still settling on auth/callback or loading screens
      if (p === "/auth/callback") return false;
      return true;
    },
    null,
    { timeout: timeoutMs },
  );

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pathname = new URL(page.url()).pathname;
    if (pathname !== "/auth/callback" && pathname !== "/auth" && predicate(pathname)) {
      await page.waitForTimeout(400); // allow brief flash after settlement
      return pathname;
    }
    if (pathname !== "/auth/callback" && predicate(pathname)) {
      await page.waitForTimeout(400);
      return pathname;
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`Timed out waiting for settled path. Last URL: ${page.url()}`);
}

export async function waitForPathname(page: Page, expected: string | RegExp, timeoutMs = 45_000) {
  await page.waitForURL(
    (url) => {
      if (typeof expected === "string") return url.pathname === expected;
      return expected.test(url.pathname);
    },
    { timeout: timeoutMs },
  );
  await page.waitForTimeout(500);
}

export type ResultRow = {
  path: string;
  expected: string;
  redirects: string;
  final: string;
  accessErrorFlash: string;
  consoleErrors: string;
  resolveFailures: string;
  passFail: "PASS" | "FAIL" | "SKIP";
  notes?: string;
};

const results: ResultRow[] = [];

export function recordResult(row: ResultRow) {
  results.push(row);
}

export function getResults(): ResultRow[] {
  return [...results];
}

export function writeResultsMarkdown(outPath: string) {
  const rows = getResults();
  const lines = [
    "# Auth routing E2E results",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${baseURL()}`,
    "",
    "| Path / scenario | Expected | Observed redirects | Final | `/access-error` flash | Console errors | resolveUserRole failures | Pass/Fail | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    const cell = (v: string) => v.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
    lines.push(
      `| ${cell(r.path)} | ${cell(r.expected)} | ${cell(r.redirects)} | ${cell(r.final)} | ${cell(r.accessErrorFlash)} | ${cell(r.consoleErrors)} | ${cell(r.resolveFailures)} | ${r.passFail} | ${cell(r.notes || "")} |`,
    );
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
}

export function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

export function formatRedirects(trace: RedirectTrace): string {
  const seq = [trace.startingUrl, ...trace.redirects.map(shortenUrl)];
  // de-dupe consecutive
  const out: string[] = [];
  for (const s of seq) {
    const short = s.startsWith("http") ? shortenUrl(s) : s;
    if (!out.length || out[out.length - 1] !== short) out.push(short);
  }
  return out.join(" → ");
}
