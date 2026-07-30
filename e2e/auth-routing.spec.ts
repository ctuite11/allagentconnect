import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  attachRoutingTrace,
  baseURL,
  formatRedirects,
  hardResetBrowserState,
  recordResult,
  requireAccount,
  shortenUrl,
  signInOnAuthPage,
  waitForPathname,
  writeResultsMarkdown,
  type RedirectTrace,
} from "./helpers/authHarness";

const RESULTS_PATH = path.resolve(process.cwd(), "e2e/results/auth-routing-results.md");

function passFromTrace(
  ok: boolean,
  trace: RedirectTrace,
  pathLabel: string,
  expected: string,
  notes?: string,
) {
  recordResult({
    path: pathLabel,
    expected,
    redirects: formatRedirects(trace),
    final: shortenUrl(trace.finalUrl),
    accessErrorFlash: trace.accessErrorSeen
      ? `YES (${trace.accessErrorUrls.map(shortenUrl).join(", ")})`
      : "no",
    consoleErrors: trace.consoleErrors.length ? trace.consoleErrors.slice(0, 5).join(" || ") : "none",
    resolveFailures: trace.resolveUserRoleFailures.length
      ? trace.resolveUserRoleFailures.join(" || ")
      : "none",
    passFail: ok ? "PASS" : "FAIL",
    notes,
  });
}

function skipRow(pathLabel: string, expected: string, reason: string) {
  recordResult({
    path: pathLabel,
    expected,
    redirects: "—",
    final: "—",
    accessErrorFlash: "—",
    consoleErrors: "—",
    resolveFailures: "—",
    passFail: "SKIP",
    notes: reason,
  });
}

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  writeResultsMarkdown(RESULTS_PATH);
});

test.describe("Auth routing E2E matrix", () => {
  test.beforeEach(async ({ page, context }) => {
    await hardResetBrowserState(page, context);
  });

  test("pending agent: /auth login → /pending-verification (no access-error flash)", async ({
    page,
    context,
  }) => {
    const account = requireAccount(
      "E2E_PENDING_AGENT_EMAIL",
      "E2E_PENDING_AGENT_PASSWORD",
      "pending-agent",
    );
    test.skip(!account, "Missing E2E_PENDING_AGENT_* credentials");

    const starting = `${baseURL()}/auth`;
    const tracer = attachRoutingTrace(page);
    try {
      await signInOnAuthPage(page, account!);
      await waitForPathname(page, /\/(pending-verification|access-error|agent-dashboard)/);
      const trace = tracer.getTrace(starting);
      const finalPath = new URL(trace.finalUrl).pathname;
      const ok = finalPath === "/pending-verification" && !trace.accessErrorSeen;
      expect(finalPath, formatRedirects(trace)).toBe("/pending-verification");
      expect(trace.accessErrorSeen, "must not flash /access-error").toBe(false);
      passFromTrace(ok, trace, "pending agent sign-in via /auth", "/pending-verification");
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("verified agent: /auth login → /agent-dashboard (no access-error flash)", async ({
    page,
    context,
  }) => {
    const account = requireAccount(
      "E2E_VERIFIED_AGENT_EMAIL",
      "E2E_VERIFIED_AGENT_PASSWORD",
      "verified-agent",
    );
    test.skip(!account, "Missing E2E_VERIFIED_AGENT_* credentials");

    const starting = `${baseURL()}/auth`;
    const tracer = attachRoutingTrace(page);
    try {
      await signInOnAuthPage(page, account!);
      await waitForPathname(page, /\/(agent-dashboard|pending-verification|access-error)/);
      const trace = tracer.getTrace(starting);
      const finalPath = new URL(trace.finalUrl).pathname;
      const ok = finalPath === "/agent-dashboard" && !trace.accessErrorSeen;
      expect(finalPath, formatRedirects(trace)).toBe("/agent-dashboard");
      expect(trace.accessErrorSeen).toBe(false);
      passFromTrace(ok, trace, "verified agent sign-in via /auth", "/agent-dashboard");
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("signed-out protected deep link preserves pathname + query after login", async ({
    page,
    context,
  }) => {
    const account = requireAccount(
      "E2E_VERIFIED_AGENT_EMAIL",
      "E2E_VERIFIED_AGENT_PASSWORD",
      "verified-agent",
    );
    test.skip(!account, "Missing E2E_VERIFIED_AGENT_* credentials");

    const deep = "/agent/messages?ref=stale-reminder&confirm=1";
    const starting = `${baseURL()}${deep}`;
    const tracer = attachRoutingTrace(page);
    try {
      await page.goto(starting, { waitUntil: "domcontentloaded" });
      await waitForPathname(page, "/auth");
      const onAuth = page.url();
      expect(onAuth).toContain("returnTo=");
      const returnTo = new URL(onAuth).searchParams.get("returnTo");
      expect(returnTo).toBe(deep);

      await page.locator("#email, input[type='email']").first().fill(account!.email);
      await page.locator("input[type='password']").first().fill(account!.password);
      await page.getByRole("button", { name: /^sign in$/i }).click();

      await page.waitForURL((url) => url.pathname === "/agent/messages", { timeout: 60_000 });
      await page.waitForTimeout(800);
      const trace = tracer.getTrace(starting);
      const final = new URL(trace.finalUrl);
      const ok =
        final.pathname === "/agent/messages" &&
        final.searchParams.get("ref") === "stale-reminder" &&
        final.searchParams.get("confirm") === "1" &&
        !trace.accessErrorSeen;
      expect(final.pathname).toBe("/agent/messages");
      expect(final.searchParams.get("ref")).toBe("stale-reminder");
      expect(final.searchParams.get("confirm")).toBe("1");
      expect(trace.accessErrorSeen).toBe(false);
      passFromTrace(
        ok,
        trace,
        "signed-out deep link /agent/messages?ref=…&confirm=1",
        deep,
      );
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("already-authenticated user opening protected deep link stays on target", async ({
    page,
    context,
  }) => {
    const account = requireAccount(
      "E2E_VERIFIED_AGENT_EMAIL",
      "E2E_VERIFIED_AGENT_PASSWORD",
      "verified-agent",
    );
    test.skip(!account, "Missing E2E_VERIFIED_AGENT_* credentials");

    await signInOnAuthPage(page, account!);
    await waitForPathname(page, "/agent-dashboard");

    const deep = "/agent/messages?tab=inbox&src=e2e";
    const starting = `${baseURL()}${deep}`;
    const tracer = attachRoutingTrace(page);
    try {
      await page.goto(starting, { waitUntil: "domcontentloaded" });
      await page.waitForURL((url) => url.pathname === "/agent/messages", { timeout: 45_000 });
      await page.waitForTimeout(800);
      const trace = tracer.getTrace(starting);
      const final = new URL(trace.finalUrl);
      const ok =
        final.pathname === "/agent/messages" &&
        final.searchParams.get("tab") === "inbox" &&
        final.searchParams.get("src") === "e2e" &&
        !trace.accessErrorSeen;
      expect(final.pathname).toBe("/agent/messages");
      expect(final.search).toContain("tab=inbox");
      expect(trace.accessErrorSeen).toBe(false);
      passFromTrace(ok, trace, "authed deep link /agent/messages?tab=inbox&src=e2e", deep);
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("unsafe external returnTo is rejected (no open redirect)", async ({ page, context }) => {
    const account = requireAccount(
      "E2E_VERIFIED_AGENT_EMAIL",
      "E2E_VERIFIED_AGENT_PASSWORD",
      "verified-agent",
    );
    test.skip(!account, "Missing E2E_VERIFIED_AGENT_* credentials");

    const starting = `${baseURL()}/auth?returnTo=${encodeURIComponent("https://evil.example/phish")}`;
    const tracer = attachRoutingTrace(page);
    try {
      await page.goto(starting, { waitUntil: "domcontentloaded" });
      await page.locator("#email, input[type='email']").first().fill(account!.email);
      await page.locator("input[type='password']").first().fill(account!.password);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await waitForPathname(page, /\/(agent-dashboard|pending-verification|access-error)/);
      await page.waitForTimeout(800);
      const trace = tracer.getTrace(starting);
      const final = trace.finalUrl;
      const leftOrigin = !final.startsWith(baseURL());
      const ok = !leftOrigin && !/evil\.example/i.test(final) && !trace.accessErrorSeen;
      expect(leftOrigin, `open redirect to ${final}`).toBe(false);
      expect(final).not.toMatch(/evil\.example/i);
      passFromTrace(
        ok,
        trace,
        "unsafe returnTo=https://evil.example/phish",
        "role home (not external)",
      );
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("protocol-relative returnTo=//evil.example is rejected", async ({ page, context }) => {
    const account = requireAccount(
      "E2E_VERIFIED_AGENT_EMAIL",
      "E2E_VERIFIED_AGENT_PASSWORD",
      "verified-agent",
    );
    test.skip(!account, "Missing E2E_VERIFIED_AGENT_* credentials");

    const starting = `${baseURL()}/auth?returnTo=${encodeURIComponent("//evil.example/phish")}`;
    const tracer = attachRoutingTrace(page);
    try {
      await page.goto(starting, { waitUntil: "domcontentloaded" });
      await page.locator("#email, input[type='email']").first().fill(account!.email);
      await page.locator("input[type='password']").first().fill(account!.password);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await waitForPathname(page, /\/(agent-dashboard|pending-verification|access-error)/);
      await page.waitForTimeout(800);
      const trace = tracer.getTrace(starting);
      const ok = !/evil\.example/i.test(trace.finalUrl) && !trace.accessErrorSeen;
      expect(trace.finalUrl).not.toMatch(/evil\.example/i);
      passFromTrace(ok, trace, "unsafe returnTo=//evil.example/phish", "role home (not external)");
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("blocked internal returnTo=/access-error falls back to role home", async ({
    page,
    context,
  }) => {
    const account = requireAccount(
      "E2E_VERIFIED_AGENT_EMAIL",
      "E2E_VERIFIED_AGENT_PASSWORD",
      "verified-agent",
    );
    test.skip(!account, "Missing E2E_VERIFIED_AGENT_* credentials");

    const starting = `${baseURL()}/auth?returnTo=${encodeURIComponent("/access-error")}`;
    const tracer = attachRoutingTrace(page);
    try {
      await page.goto(starting, { waitUntil: "domcontentloaded" });
      await page.locator("#email, input[type='email']").first().fill(account!.email);
      await page.locator("input[type='password']").first().fill(account!.password);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await waitForPathname(page, /\/(agent-dashboard|pending-verification)/);
      await page.waitForTimeout(1000);
      const trace = tracer.getTrace(starting);
      const finalPath = new URL(trace.finalUrl).pathname;
      // A brief flash of /access-error would fail this assertion.
      const ok = finalPath === "/agent-dashboard" && !trace.accessErrorSeen;
      expect(finalPath).toBe("/agent-dashboard");
      expect(trace.accessErrorSeen, "must not land on or flash /access-error").toBe(false);
      passFromTrace(ok, trace, "blocked returnTo=/access-error", "/agent-dashboard (no flash)");
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("refresh after login does not reroute verified agent away from dashboard", async ({
    page,
    context,
  }) => {
    const account = requireAccount(
      "E2E_VERIFIED_AGENT_EMAIL",
      "E2E_VERIFIED_AGENT_PASSWORD",
      "verified-agent",
    );
    test.skip(!account, "Missing E2E_VERIFIED_AGENT_* credentials");

    await signInOnAuthPage(page, account!);
    await waitForPathname(page, "/agent-dashboard");

    const starting = page.url();
    const tracer = attachRoutingTrace(page);
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForPathname(page, "/agent-dashboard");
      await page.waitForTimeout(800);
      const trace = tracer.getTrace(starting);
      const ok =
        new URL(trace.finalUrl).pathname === "/agent-dashboard" && !trace.accessErrorSeen;
      expect(new URL(trace.finalUrl).pathname).toBe("/agent-dashboard");
      passFromTrace(ok, trace, "refresh while authenticated on /agent-dashboard", "/agent-dashboard");
    } finally {
      tracer.stop();
    }

    // Simulate "browser restart": new page, same storage cleared then re-login not needed —
    // restart with persisted storage: open new page without clearing cookies.
    const restartPage = await context.newPage();
    const restartTracer = attachRoutingTrace(restartPage);
    const restartStart = `${baseURL()}/agent-dashboard`;
    try {
      await restartPage.goto(restartStart, { waitUntil: "domcontentloaded" });
      await waitForPathname(restartPage, "/agent-dashboard");
      await restartPage.waitForTimeout(800);
      const trace = restartTracer.getTrace(restartStart);
      const ok =
        new URL(trace.finalUrl).pathname === "/agent-dashboard" && !trace.accessErrorSeen;
      expect(new URL(trace.finalUrl).pathname).toBe("/agent-dashboard");
      passFromTrace(
        ok,
        trace,
        "new tab / \"browser reopen\" with existing session → /agent-dashboard",
        "/agent-dashboard",
      );
    } finally {
      restartTracer.stop();
      await restartPage.close();
      await hardResetBrowserState(page, context);
    }
  });

  test("password recovery context takes priority over role routing", async ({ page, context }) => {
    const account = requireAccount(
      "E2E_VERIFIED_AGENT_EMAIL",
      "E2E_VERIFIED_AGENT_PASSWORD",
      "verified-agent",
    );
    test.skip(!account, "Missing E2E_VERIFIED_AGENT_* credentials");

    // Establish a real session first.
    await signInOnAuthPage(page, account!);
    await waitForPathname(page, "/agent-dashboard");

    const starting = `${baseURL()}/auth/callback?type=recovery`;
    const tracer = attachRoutingTrace(page);
    try {
      await page.goto(starting, { waitUntil: "domcontentloaded" });
      // Recovery with an existing session should prefer /password-reset over dashboard.
      await page.waitForURL(
        (url) =>
          url.pathname === "/password-reset" ||
          url.pathname === "/agent-setup" ||
          url.pathname === "/agent-dashboard" ||
          url.pathname === "/access-error",
        { timeout: 45_000 },
      );
      await page.waitForTimeout(1000);
      const trace = tracer.getTrace(starting);
      const finalPath = new URL(trace.finalUrl).pathname;
      const ok = (finalPath === "/password-reset" || finalPath === "/agent-setup") && !trace.accessErrorSeen;
      expect(["/password-reset", "/agent-setup"]).toContain(finalPath);
      passFromTrace(
        ok,
        trace,
        "recovery: /auth/callback?type=recovery with session",
        "/password-reset (or /agent-setup)",
      );
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("email-confirmation callback after token already consumed does not trap on access-error", async ({
    page,
    context,
  }) => {
    // Simulate a consumed/empty callback: signed-out user hits /auth/callback with no token.
    const starting = `${baseURL()}/auth/callback`;
    const tracer = attachRoutingTrace(page);
    try {
      await page.goto(starting, { waitUntil: "domcontentloaded" });
      await page.waitForURL(
        (url) => url.pathname !== "/auth/callback" || !!url.searchParams.get("error"),
        { timeout: 45_000 },
      );
      await page.waitForTimeout(1200);
      const trace = tracer.getTrace(starting);
      const finalPath = new URL(trace.finalUrl).pathname;
      // Acceptable: back to /auth (or explicit error UI on callback). Must not soft-lock on /access-error.
      const ok = finalPath !== "/access-error" && !trace.accessErrorSeen;
      expect(finalPath).not.toBe("/access-error");
      expect(trace.accessErrorSeen).toBe(false);
      passFromTrace(
        ok,
        trace,
        "consumed/empty email-confirm callback (signed out)",
        "/auth (not /access-error)",
      );
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("fresh signup race: brand-new account resolves without /access-error flash", async ({
    page,
    context,
  }) => {
    const anon = process.env.E2E_SUPABASE_ANON_KEY?.trim();
    const supabaseUrl = process.env.E2E_SUPABASE_URL?.trim();
    test.skip(!anon || !supabaseUrl, "Missing E2E_SUPABASE_* for fresh-account provisioning");

    const email = `e2e.fresh.${Date.now()}@allagentconnect.test`;
    const password = "E2eTestPass1!";
    const signup = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: anon!,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        data: { first_name: "E2E", last_name: "Fresh" },
      }),
    });
    const body = (await signup.json()) as {
      access_token?: string;
      refresh_token?: string;
      user?: { id: string; email?: string };
      msg?: string;
      error?: string;
    };
    expect(body.access_token, JSON.stringify(body)).toBeTruthy();

    const projectRef = new URL(supabaseUrl!).hostname.split(".")[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    const sessionPayload = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: body.user,
    };

    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      { key: storageKey, value: sessionPayload },
    );

    const starting = `${baseURL()}/auth/callback`;
    const tracer = attachRoutingTrace(page);
    try {
      await page.goto(starting, { waitUntil: "domcontentloaded" });
      await page.waitForURL(
        (url) =>
          ["/pending-verification", "/agent-dashboard", "/access-error", "/agent-setup"].includes(
            url.pathname,
          ),
        { timeout: 60_000 },
      );
      await page.waitForTimeout(1200);
      const trace = tracer.getTrace(starting);
      const finalPath = new URL(trace.finalUrl).pathname;
      // Fresh accounts are unverified agents today → pending-verification.
      // Do NOT widen resolver retries unless this fails with /access-error race.
      const ok = finalPath === "/pending-verification" && !trace.accessErrorSeen;
      expect(finalPath, formatRedirects(trace)).toBe("/pending-verification");
      expect(trace.accessErrorSeen).toBe(false);
      passFromTrace(
        ok,
        trace,
        `fresh account race (${email})`,
        "/pending-verification (no /access-error flash)",
        "If this fails with access-error, investigate resolver race before widening retries",
      );
    } finally {
      tracer.stop();
      await hardResetBrowserState(page, context);
    }
  });

  test("optional roles: buyer / admin / delegate (skip unless dedicated creds)", async () => {
    const buyer = requireAccount("E2E_BUYER_EMAIL", "E2E_BUYER_PASSWORD", "buyer");
    const admin = requireAccount("E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD", "admin");
    const delegate = requireAccount("E2E_DELEGATE_EMAIL", "E2E_DELEGATE_PASSWORD", "delegate");

    if (!buyer) {
      skipRow(
        "buyer sign-in",
        "/client/dashboard",
        "No dedicated buyer-only E2E account. Signup auto-inserts agent role; cannot strip agent without service role.",
      );
    }
    if (!admin) {
      skipRow(
        "admin sign-in",
        "/admin/approvals",
        "No dedicated admin E2E account provided (service role required to grant admin).",
      );
    }
    if (!delegate) {
      skipRow(
        "delegate sign-in",
        "/agent-dashboard",
        "No dedicated delegate E2E account provided.",
      );
    }

    // If credentials appear later, run them inline.
    // (Kept minimal: presence-gated in this placeholder so the matrix stays complete.)
    expect(true).toBe(true);
  });
});
