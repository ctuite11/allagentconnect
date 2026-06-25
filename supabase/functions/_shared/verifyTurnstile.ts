/**
 * Shared server-side Cloudflare Turnstile verifier.
 *
 * - Reads TURNSTILE_SECRET_KEY from env (never logged).
 * - Returns { ok: true } only when Cloudflare confirms success.
 * - Never logs the raw token, secret, or full client IP.
 * - Callers should return HTTP 403 with the generic user-facing message:
 *     "Verification failed. Please refresh and try again."
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_GENERIC_ERROR =
  "Verification failed. Please refresh and try again.";

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

/**
 * Verify a Turnstile token. Pass the request so we can include remoteip.
 * The raw IP is sent to Cloudflare but never logged here.
 */
export async function verifyTurnstileToken(
  token: unknown,
  req?: Request,
): Promise<TurnstileVerifyResult> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not configured");
    return { ok: false, reason: "not_configured" };
  }

  if (typeof token !== "string" || token.trim().length === 0) {
    console.warn("[turnstile] reject: missing token");
    return { ok: false, reason: "missing_token" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (req) {
    const ip = getClientIp(req);
    if (ip) body.set("remoteip", ip);
  }

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (err) {
    console.error("[turnstile] siteverify network error:", err instanceof Error ? err.message : String(err));
    return { ok: false, reason: "network_error" };
  }

  if (!res.ok) {
    console.warn("[turnstile] siteverify non-2xx status:", res.status);
    return { ok: false, reason: `http_${res.status}` };
  }

  let data: { success?: boolean; action?: string; "error-codes"?: string[] } | null = null;
  try {
    data = await res.json();
  } catch (err) {
    console.error("[turnstile] siteverify invalid JSON:", err instanceof Error ? err.message : String(err));
    return { ok: false, reason: "invalid_response" };
  }

  if (!data || data.success !== true) {
    // Cloudflare error codes are safe to log (no secret/token content).
    const codes = Array.isArray(data?.["error-codes"]) ? data!["error-codes"] : [];
    console.warn("[turnstile] reject: verification failed", { codes, action: data?.action ?? null });
    return { ok: false, reason: "verification_failed" };
  }

  return { ok: true };
}

/**
 * Convenience helper: build a generic 403 Response on failure.
 * Pass the corsHeaders the caller already uses so CORS stays consistent.
 */
export function turnstileFailureResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: TURNSTILE_GENERIC_ERROR }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}