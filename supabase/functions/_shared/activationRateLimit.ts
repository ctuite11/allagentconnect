/**
 * Rate limiting for the read-only activation preview path.
 *
 * Properties this must preserve:
 *  * It NEVER touches, claims, consumes or mutates the activation token. The
 *    counter lives in public.rate_limits and is keyed by a truncated hash of
 *    the submitted token, so no plaintext token value is ever persisted here
 *    or written to a log line.
 *  * The 429 response is generic. It is returned identically for a valid
 *    token, an expired token and a token that never existed, so hammering the
 *    endpoint discloses nothing about whether an account exists.
 *  * The limiter fails OPEN on its own outage. A limiter problem must never
 *    stop a legitimate agent from activating.
 *  * Thresholds are deliberately generous relative to human behaviour: a real
 *    agent reloading the setup page, or retrying after a typo, cannot lock
 *    themselves out within the window.
 */

/** Rolling-ish fixed window shared by both dimensions. */
export const ACTIVATION_PREVIEW_WINDOW_SECONDS = 600; // 10 minutes

/** Per-token: one link opened by one human. 12 previews / 10 min. */
export const ACTIVATION_PREVIEW_TOKEN_LIMIT = 12;

/** Per-IP: tolerates shared office / NAT egress. 60 previews / 10 min. */
export const ACTIVATION_PREVIEW_IP_LIMIT = 60;

export interface RateLimitDecision {
  allowed: boolean;
  resetAt: string;
}

async function consume(
  admin: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  key: string,
  windowSeconds: number,
  limit: number,
): Promise<RateLimitDecision> {
  try {
    const { data, error } = await admin.rpc("rate_limit_consume", {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    });
    if (error) {
      // Fail open — never block activation because the limiter is unhealthy.
      console.error("[activation-rate-limit] rpc error");
      return { allowed: true, resetAt: new Date().toISOString() };
    }
    const row = (data ?? {}) as { allowed?: boolean; reset_at?: string };
    return {
      allowed: Boolean(row.allowed),
      resetAt: String(row.reset_at ?? new Date().toISOString()),
    };
  } catch {
    console.error("[activation-rate-limit] rpc threw");
    return { allowed: true, resetAt: new Date().toISOString() };
  }
}

/** First public IP from the standard proxy headers, or null. */
export function clientIpFrom(req: Request): string | null {
  const raw =
    req.headers.get("x-aac-client-ip") ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for") ||
    "";
  const first = raw.split(",")[0]?.trim() ?? "";
  if (!first || first.length > 64) return null;
  return first;
}

/**
 * @param tokenHash sha256 hex of the submitted token — never the token itself.
 */
export async function enforceActivationPreviewLimits(
  admin: Parameters<typeof consume>[0],
  tokenHash: string,
  clientIp: string | null,
): Promise<RateLimitDecision> {
  const byToken = await consume(
    admin,
    `activation-preview|token:${tokenHash.slice(0, 32)}`,
    ACTIVATION_PREVIEW_WINDOW_SECONDS,
    ACTIVATION_PREVIEW_TOKEN_LIMIT,
  );
  if (!byToken.allowed) return byToken;

  if (clientIp) {
    const byIp = await consume(
      admin,
      `activation-preview|ip:${clientIp}`,
      ACTIVATION_PREVIEW_WINDOW_SECONDS,
      ACTIVATION_PREVIEW_IP_LIMIT,
    );
    if (!byIp.allowed) return byIp;
  }

  return { allowed: true, resetAt: byToken.resetAt };
}

/** Generic, information-free throttle response. */
export function activationRateLimited(
  resetAt: string,
  corsHeaders: Record<string, string>,
): Response {
  const retryAfter = Math.max(
    1,
    Math.min(
      ACTIVATION_PREVIEW_WINDOW_SECONDS,
      Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000),
    ),
  );
  return new Response(JSON.stringify({ status: "rate_limited" }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": String(retryAfter),
    },
  });
}
