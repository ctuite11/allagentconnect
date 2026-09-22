/**
 * Same-origin JSON proxy for the read-only activation preview.
 *
 * The browser posts the fragment token here so the request stays same-origin
 * and the opaque resend handle can be stored in an HttpOnly cookie exactly as
 * the legacy /api/activate-redeem path does. The handle is never exposed to
 * page JavaScript, and the activation token is never written to a URL, a
 * cookie, localStorage or a log line.
 */
import type { Handler } from "@netlify/functions";

const RESEND_COOKIE = "aac_activation_resend";

const ALLOWED_ORIGINS = new Set([
  "https://allagentconnect.com",
  "https://www.allagentconnect.com",
]);

export function isSameOriginRequest(event: Parameters<Handler>[0]): boolean {
  const origin = event.headers.origin || event.headers.Origin;
  if (origin) return ALLOWED_ORIGINS.has(origin);
  const referer = event.headers.referer || event.headers.Referer;
  if (!referer) return false;
  try {
    return ALLOWED_ORIGINS.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

export function resendCookie(handle: string): string {
  return `${RESEND_COOKIE}=${handle}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900`;
}

export function clearResendCookieHeader(): string {
  return `${RESEND_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function jsonResponse(
  status: number,
  payload: Record<string, unknown>,
  cookie?: string,
) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
    body: JSON.stringify(payload),
  };
}

/** First public client IP Netlify saw, for per-IP throttling only. */
export function clientIpFromEvent(event: Parameters<Handler>[0]): string {
  const h = event.headers || {};
  const raw =
    h["x-nf-client-connection-ip"] ||
    h["X-Nf-Client-Connection-Ip"] ||
    h["x-forwarded-for"] ||
    h["X-Forwarded-For"] ||
    "";
  const first = String(raw).split(",")[0]?.trim() ?? "";
  return first.length > 0 && first.length <= 64 ? first : "";
}

export async function callActivationFunction(
  fnName: string,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Record<string, unknown> | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const ANON =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify(payload),
    });
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (err) {
    // Never log the token or the password.
    console.error(`[${fnName}] request failed:`, (err as Error).message);
    return null;
  }
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { status: "method_not_allowed" });
  if (!isSameOriginRequest(event)) {
    return { statusCode: 403, headers: { "Cache-Control": "no-store" }, body: "Forbidden" };
  }

  let token = "";
  try {
    const parsed = JSON.parse(
      event.isBase64Encoded
        ? Buffer.from(event.body ?? "", "base64").toString("utf8")
        : (event.body ?? "{}"),
    );
    token = typeof parsed?.token === "string" ? parsed.token.trim() : "";
  } catch {
    return jsonResponse(400, { status: "invalid" });
  }
  if (!token) return jsonResponse(400, { status: "invalid" });

  const payload = await callActivationFunction("activation-preview", { token });
  if (!payload) return jsonResponse(500, { status: "error" }, clearResendCookieHeader());

  const { resendHandle, ...safe } = payload as { resendHandle?: string | null };
  return jsonResponse(
    200,
    safe as Record<string, unknown>,
    typeof resendHandle === "string" && resendHandle
      ? resendCookie(resendHandle)
      : clearResendCookieHeader(),
  );
};

export { handler };
