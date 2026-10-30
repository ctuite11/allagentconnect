/**
 * Migration-only outbound isolation. Missing flags mean LOCKED.
 * No recipient, cookie, API key, URL path or query is included in errors.
 * SQL triggers, cron and hosted Auth configuration require the separate SQL/UI lock.
 */
export type EnvReader = (name: string) => string | undefined;

export const LEGACY_BACKEND_HOST = "kwfqjnepesiihjkdnxou.supabase.co";

export function readRuntimeEnv(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    Netlify?: { env: { get(name: string): string | undefined } };
    Deno?: { env: { get(name: string): string | undefined } };
    process?: { env: Record<string, string | undefined> };
  };
  if (runtime.Netlify?.env) return runtime.Netlify.env.get(name);
  if (runtime.Deno?.env) return runtime.Deno.env.get(name);
  return runtime.process?.env[name];
}

/** Both explicit release flags are necessary. Empty/typo/partial config stays locked. */
export function migrationOutboundLocked(env: EnvReader = readRuntimeEnv): boolean {
  return env("MIGRATION_OUTBOUND_DISABLED")?.trim() !== "false" ||
    env("MIGRATION_RELEASE_APPROVED")?.trim() !== "true";
}

export class MigrationOutboundBlockedError extends Error {
  readonly code = "MIGRATION_OUTBOUND_BLOCKED";
  constructor(reason = "delivery is disabled") {
    super(`MIGRATION_OUTBOUND_BLOCKED: ${reason}`);
    this.name = "MigrationOutboundBlockedError";
  }
}

export function assertMigrationDeliveryAllowed(env: EnvReader = readRuntimeEnv): void {
  if (migrationOutboundLocked(env) || env("EMAIL_SENDING_PAUSED")?.trim().toLowerCase() === "true") {
    throw new MigrationOutboundBlockedError();
  }
}

export function assertMigrationActionAllowed(env: EnvReader = readRuntimeEnv): void {
  if (migrationOutboundLocked(env)) throw new MigrationOutboundBlockedError();
}

export function destinationOrigin(env: EnvReader): string {
  const value = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  let url: URL;
  try { url = new URL(value ?? ""); }
  catch { throw new MigrationOutboundBlockedError("destination SUPABASE_URL is missing or invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      (url.pathname !== "/" && url.pathname !== "") || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) || url.hostname === LEGACY_BACKEND_HOST ||
      url.hostname.endsWith(`.${LEGACY_BACKEND_HOST}`)) {
    throw new MigrationOutboundBlockedError("destination must be the new HTTPS project origin");
  }
  return url.origin;
}

/** Explicit read-only provider operations used by this source. No arbitrary-host bypass. */
function allowedReadOnlyProvider(url: URL, method: string): boolean {
  if (method === "GET" || method === "HEAD") {
    if (url.origin === "https://api.gateway.attomdata.com") return url.pathname.startsWith("/propertyapi/");
    if (url.origin === "https://api.repliers.io") return /^\/(listings|autocomplete)(\/|$)/.test(url.pathname);
    if (url.origin === "https://maps.googleapis.com") return url.pathname.startsWith("/maps/api/");
    if (url.origin === "https://api.walkscore.com") return url.pathname === "/score";
    if (url.origin === "https://api.zippopotam.us") return url.pathname.startsWith("/us/");
    if (url.origin === "https://api.pwnedpasswords.com") return url.pathname.startsWith("/range/");
  }
  return method === "POST" && url.origin === "https://challenges.cloudflare.com" &&
    url.pathname === "/turnstile/v0/siteverify";
}

export function assertMigrationRequestAllowed(
  input: string | URL | Request,
  init: RequestInit | undefined,
  env: EnvReader,
): void {
  let url: URL;
  try { url = new URL(input instanceof Request ? input.url : String(input)); }
  catch { throw new MigrationOutboundBlockedError("invalid outbound URL"); }
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  // The legacy backend remains forbidden even after the release flags are opened.
  const hostname = url.hostname.replace(/\.$/, "");
  if (hostname === LEGACY_BACKEND_HOST || hostname.endsWith(`.${LEGACY_BACKEND_HOST}`)) {
    throw new MigrationOutboundBlockedError("legacy production backend is forbidden");
  }
  const target = destinationOrigin(env);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new MigrationOutboundBlockedError("only HTTPS without URL credentials is permitted");
  }
  if (hostname === "api.resend.com" && env("EMAIL_SENDING_PAUSED")?.trim().toLowerCase() === "true") {
    throw new MigrationOutboundBlockedError("email sending is paused");
  }
  if (!migrationOutboundLocked(env)) return;

  if (url.origin === target) {
    if (!/^\/(rest|auth|storage|functions)\/v1\//.test(url.pathname)) {
      throw new MigrationOutboundBlockedError("unrecognized destination API path");
    }
    // Prevent a path-normalization or encoded-slash bypass of the Auth restriction.
    let path: string;
    try { path = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/"); }
    catch { throw new MigrationOutboundBlockedError("invalid encoded path"); }
    if (url.pathname.startsWith("/auth/v1/")) {
      const safeRead = method === "GET" || method === "HEAD";
      const safeSession = method === "POST" && /^\/auth\/v1\/(token|logout)\/?$/.test(path);
      if (!safeRead && !safeSession) {
        throw new MigrationOutboundBlockedError("Auth signup, invite, recovery and account-change delivery is locked");
      }
    }
    // Avoid using another Supabase project through an application-supplied URL.
    return;
  }
  if (allowedReadOnlyProvider(url, method)) return;
  throw new MigrationOutboundBlockedError(`external destination ${url.hostname} is not allowed during migration`);
}

export function createMigrationFetch(
  originalFetch: typeof fetch,
  env: EnvReader = readRuntimeEnv,
): typeof fetch {
  return async (input, init) => {
    assertMigrationRequestAllowed(input, init, env);
    // Native fetch otherwise follows redirects without passing each hop through this guard.
    const guardedInit = migrationOutboundLocked(env) ? { ...init, redirect: "error" as const } : init;
    return originalFetch(input, guardedInit);
  };
}

const installed = Symbol.for("aac.migration.fetch-guard.v1");
export function installMigrationFetchGuard(env: EnvReader = readRuntimeEnv): void {
  const runtime = globalThis as typeof globalThis & Record<symbol, unknown>;
  if (runtime[installed]) return;
  globalThis.fetch = createMigrationFetch(globalThis.fetch.bind(globalThis), env);
  runtime[installed] = true;
}
