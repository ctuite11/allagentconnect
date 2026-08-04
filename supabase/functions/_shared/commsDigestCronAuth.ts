/**
 * Auth for the process-comms-digests cron endpoint.
 *
 * Fail closed:
 *   - missing / empty COMMS_DIGEST_CRON_SECRET env → 503 misconfigured
 *   - missing / wrong x-comms-digest-cron-secret header → 401
 *
 * The Edge Function secret must match the Vault secret named
 * `comms_digest_cron_secret` used by public.invoke_process_comms_digests().
 */

export const COMMS_DIGEST_CRON_SECRET_HEADER = "x-comms-digest-cron-secret";
export const COMMS_DIGEST_CRON_SECRET_ENV = "COMMS_DIGEST_CRON_SECRET";

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type DigestCronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

type EnvLike = { get(key: string): string | undefined };

/**
 * Authorize a digest cron request against the configured shared secret.
 */
export function authorizeCommsDigestCron(
  req: Request,
  env: EnvLike = Deno.env,
): DigestCronAuthResult {
  const expected = (env.get(COMMS_DIGEST_CRON_SECRET_ENV) ?? "").trim();
  if (!expected) {
    return { ok: false, status: 503, error: "misconfigured" };
  }

  const provided = (req.headers.get(COMMS_DIGEST_CRON_SECRET_HEADER) ?? "").trim();
  if (!provided || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
