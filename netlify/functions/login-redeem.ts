/**
 * Same-origin sign-in-link redemption endpoint.
 *
 * The login token arrives in the URL *fragment*, so it never reaches a
 * server log, a Referer header, or a CDN access log. The real form POST
 * carries the token in the request BODY only. On failure the user is sent
 * back to /signin-link with a state code — the token is never echoed into
 * a redirect URL, query string, cookie, localStorage, or log line.
 */
import type { Handler } from "@netlify/functions";

const ALLOWED_ORIGINS = new Set([
  "https://allagentconnect.com",
  "https://www.allagentconnect.com",
]);

function isSameOrigin(event: Parameters<Handler>[0]): boolean {
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

function redirect(location: string) {
  return {
    statusCode: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
    body: "",
  };
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return redirect("/signin-link?state=invalid");
  if (!isSameOrigin(event)) {
    return { statusCode: 403, headers: { "Cache-Control": "no-store" }, body: "Forbidden" };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const ANON =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !ANON) return redirect("/signin-link?state=error");

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "");
  const token = new URLSearchParams(raw).get("t")?.trim() ?? "";
  if (!token) return redirect("/signin-link?state=invalid");

  let payload: { status?: string; redirect?: string } = {};
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-login-token`, {
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
    console.error("[login-redeem] redemption request failed:", (err as Error).message);
    return redirect("/signin-link?state=error");
  }

  if (payload.status === "ok" && payload.redirect) return redirect(payload.redirect);

  const state =
    payload.status === "expired" ? "expired" :
    payload.status === "revoked" ? "revoked" :
    payload.status === "in_progress" ? "in_progress" :
    payload.status === "used" ? "used" :
    payload.status === "ineligible" ? "ineligible" :
    payload.status === "invalid" ? "invalid" :
    "error";

  return redirect(`/signin-link?state=${state}`);
};

export { handler };
