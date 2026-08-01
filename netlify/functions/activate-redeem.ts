/**
 * Same-origin activation redemption endpoint.
 *
 * Why this exists (instead of redeeming straight from the browser):
 *  - The activation token arrives in the URL *fragment*, so it never reaches
 *    a server log, a Referer header, or a CDN access log.
 *  - The real form POST carries the token in the request BODY only.
 *  - On failure we must hand the user a working resend affordance, but the
 *    POST navigates away from /activate and destroys component state. We
 *    therefore mint a short-lived, opaque, HttpOnly resend handle that maps
 *    server-side to the activation record. The handle cannot itself activate
 *    an account, and the activation token is never written to a redirect
 *    URL, a query string, a cookie, localStorage, or a log line.
 */
import type { Handler } from "@netlify/functions";

const RESEND_COOKIE = "aac_activation_resend";

const ALLOWED_ORIGINS = new Set([
  "https://allagentconnect.com",
  "https://www.allagentconnect.com",
]);

function isSameOrigin(event: Parameters<Handler>[0]): boolean {
  const origin = event.headers.origin || event.headers.Origin;
  if (origin) return ALLOWED_ORIGINS.has(origin);
  // Some browsers omit Origin on same-origin form posts; fall back to Referer.
  const referer = event.headers.referer || event.headers.Referer;
  if (!referer) return false;
  try {
    return ALLOWED_ORIGINS.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

function redirect(location: string, cookies?: string[]) {
  return {
    statusCode: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      ...(cookies?.length ? { "Set-Cookie": cookies[0] } : {}),
    },
    ...(cookies && cookies.length > 1 ? { multiValueHeaders: { "Set-Cookie": cookies } } : {}),
    body: "",
  };
}

function resendCookie(handle: string): string {
  // Path=/ so the cookie is also sent to /api/activate-resend.
  return `${RESEND_COOKIE}=${handle}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900`;
}

export function clearResendCookie(): string {
  return `${RESEND_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return redirect("/activate?state=invalid");
  }
  if (!isSameOrigin(event)) {
    return { statusCode: 403, headers: { "Cache-Control": "no-store" }, body: "Forbidden" };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const ANON =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !ANON) {
    return redirect("/activate?state=error");
  }

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "");
  const token = new URLSearchParams(raw).get("t")?.trim() ?? "";
  if (!token) return redirect("/activate?state=invalid");

  let payload: { status?: string; redirect?: string; resendHandle?: string | null } = {};
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-activation-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify({ token }),
    });
    payload = await res.json().catch(() => ({}));
  } catch (err) {
    // Never log the token itself.
    console.error("[activate-redeem] redemption request failed:", (err as Error).message);
    return redirect("/activate?state=error");
  }

  if (payload.status === "ok" && payload.redirect) {
    // Success: burn any outstanding resend handle cookie.
    return redirect(payload.redirect, [clearResendCookie()]);
  }

  const state =
    payload.status === "expired" ? "expired" :
    payload.status === "revoked" ? "expired" :
    payload.status === "in_progress" ? "in_progress" :
    payload.status === "used" ? "used" :
    payload.status === "ineligible" ? "ineligible" :
    payload.status === "invalid" ? "invalid" :
    "error";

  if (payload.resendHandle) {
    return redirect(`/activate?state=${state}`, [resendCookie(payload.resendHandle)]);
  }
  return redirect(`/activate?state=${state}`, [clearResendCookie()]);
};

export { handler };
