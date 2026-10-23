/**
 * Boot-time capture of an auth-link landing.
 *
 * The auth client reads and strips the URL hash (`#access_token=…&type=recovery`)
 * as soon as it initializes. `/auth/callback` is lazy-loaded, so by the time it
 * renders the hash can already be gone and a valid reset link looks like an
 * ordinary sign-in (the user lands on their dashboard). `main.tsx` records the
 * landing synchronously at boot, before the auth client can strip it.
 *
 * The capture is in-memory only (this page load) and only counts when the hash
 * carried real auth tokens. A bare `?type=recovery` query string never counts,
 * and nothing is persisted that could hijack a later ordinary sign-in.
 * Callers must still require an authenticated session before showing the form.
 */
export interface RecoveryLanding {
  isRecovery: boolean;
  isSetup: boolean;
}

const NONE: RecoveryLanding = { isRecovery: false, isSetup: false };
let bootLanding: RecoveryLanding = NONE;

export function detectRecoveryLanding(hash: string, search: string): RecoveryLanding {
  const h = new URLSearchParams((hash || "").replace(/^#/, ""));
  const q = new URLSearchParams(search || "");
  const hasTokens = !!h.get("access_token") && !!h.get("refresh_token");
  if (!hasTokens || h.get("type") !== "recovery") return NONE;
  return { isRecovery: true, isSetup: h.get("setup") === "1" || q.get("setup") === "1" };
}

export function recordBootRecoveryLanding(hash: string, search: string): RecoveryLanding {
  bootLanding = detectRecoveryLanding(hash, search);
  return bootLanding;
}

export function getBootRecoveryLanding(): RecoveryLanding {
  return bootLanding;
}

/** Forget the capture once used (or after a password update / normal sign-in). */
export function clearBootRecoveryLanding(): void {
  bootLanding = NONE;
}

export type PostAuthLanding = "agent-setup" | "password-reset" | "normal";

/**
 * Where an authenticated arrival at /auth/callback must go.
 * - Without a session nothing is a recovery (URL alone is never proof).
 * - License Verified setup always goes to agent setup.
 * - A recovery link (from the current URL or the boot capture) goes to the reset form.
 * - Everything else is a normal sign-in; stale stored markers are ignored.
 */
export function resolvePostAuthLanding(opts: {
  hasSession: boolean;
  urlRecovery: boolean;
  bootRecovery: boolean;
  setupActive: boolean;
}): PostAuthLanding {
  if (!opts.hasSession) return "normal";
  if (opts.setupActive) return "agent-setup";
  if (opts.urlRecovery || opts.bootRecovery) return "password-reset";
  return "normal";
}
