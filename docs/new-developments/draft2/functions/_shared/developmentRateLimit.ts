/**
 * Rate limiting for New Developments submissions (DRAFT 2 — not deployed).
 *
 * Guardrail G2: every user key carries BOTH auth.uid() and development_id.
 * Guardrail G3: callers must resolve/validate the user BEFORE calling this.
 *
 * Review item 8b: the 24-hour quota depends on public.rate_limits_cleanup()
 * retaining rows for 25 hours (migration 08). Do not deploy these functions
 * against the 1-hour retention body.
 */
export interface RateLimitDecision {
  allowed: boolean;
  resetAt: string;
}

const WINDOW_10_MIN = 600;
const WINDOW_24_H = 86400;

async function consume(
  supabase: any,
  key: string,
  windowSeconds: number,
  limit: number,
): Promise<RateLimitDecision> {
  const { data, error } = await supabase.rpc("rate_limit_consume", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error) {
    // Fail open on limiter outage (existing platform behavior), never fail closed.
    console.error("[development-rate-limit] RPC error:", error.message ?? error);
    return { allowed: true, resetAt: new Date().toISOString() };
  }
  return { allowed: Boolean(data?.allowed), resetAt: String(data?.reset_at ?? new Date().toISOString()) };
}

export function userKey(route: string, developmentId: string, userId: string, suffix?: string): string {
  return `route:${route}|development:${developmentId}|user:${userId}${suffix ? `|${suffix}` : ""}`;
}

export async function enforceSubmissionRateLimits(
  supabase: any,
  route: string,
  developmentId: string,
  userId: string,
  clientIp: string | null,
): Promise<RateLimitDecision> {
  const shortWindow = await consume(supabase, userKey(route, developmentId, userId), WINDOW_10_MIN, 5);
  if (!shortWindow.allowed) return shortWindow;

  const dayWindow = await consume(supabase, userKey(route, developmentId, userId, "day"), WINDOW_24_H, 20);
  if (!dayWindow.allowed) return dayWindow;

  if (clientIp) {
    const ipWindow = await consume(supabase, `route:${route}|ip:${clientIp}`, WINDOW_10_MIN, 30);
    if (!ipWindow.allowed) return ipWindow;
  }

  return { allowed: true, resetAt: dayWindow.resetAt };
}

export function build429(resetAt: string, corsHeaders: Record<string, string>): Response {
  const retryAfter = Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000));
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  });
}
