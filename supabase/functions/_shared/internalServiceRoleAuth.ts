/**
 * Internal-only authorization for Hot Sheet producer Edge Functions.
 *
 * Fail closed:
 *   - missing / blank SUPABASE_SERVICE_ROLE_KEY → 503 misconfigured
 *   - missing / malformed / incorrect Authorization bearer → 401 Unauthorized
 *
 * Ordinary user / anon JWTs must never pass: callers must present the exact
 * service-role key as `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
 *
 * Never log or return the provided or expected token.
 */

import { timingSafeEqual } from "./commsDigestCronAuth.ts";

export const SERVICE_ROLE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";

export type ServiceRoleAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: "Unauthorized" | "misconfigured" };

type EnvLike = { get(key: string): string | undefined };

/** Extract the bearer credential; null when missing or malformed. */
export function extractBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  if (!match) return null;
  return match[1];
}

/**
 * Authorize an internal Hot Sheet producer request against the service-role key.
 */
export function authorizeInternalServiceRole(
  req: Request,
  env: EnvLike = Deno.env,
): ServiceRoleAuthResult {
  const expected = (env.get(SERVICE_ROLE_KEY_ENV) ?? "").trim();
  if (!expected) {
    return { ok: false, status: 503, error: "misconfigured" };
  }

  const provided = extractBearerToken(req.headers.get("Authorization"));
  if (!provided || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}

/** Headers required when one Edge Function invokes another with service role. */
export function serviceRoleInvokeHeaders(
  serviceRoleKey: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };
}
