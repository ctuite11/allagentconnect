/**
 * Consumes the opaque, single-use resend handle stored in an HttpOnly cookie
 * and asks the backend to issue a replacement activation email.
 *
 * The handle is only marked used inside the same database transaction that
 * creates the replacement token AND the queue job, so a transient failure
 * never burns the agent's resend.
 */
import type { Handler } from "@netlify/functions";
import { clearResendCookie } from "./activate-redeem";

const RESEND_COOKIE = "aac_activation_resend";

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

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function redirect(location: string, cookie: string) {
  return {
    statusCode: 303,
    headers: { Location: location, "Cache-Control": "no-store", "Set-Cookie": cookie },
    body: "",
  };
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return redirect("/activate?state=invalid", clearResendCookie());
  }
  if (!isSameOrigin(event)) {
    return { statusCode: 403, headers: { "Cache-Control": "no-store" }, body: "Forbidden" };
  }

  const handle = readCookie(event.headers.cookie || event.headers.Cookie, RESEND_COOKIE);
  if (!handle) return redirect("/activate?state=resend_unavailable", clearResendCookie());

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const ANON =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !ANON) {
    return redirect("/activate?state=error", clearResendCookie());
  }

  try {
    await fetch(`${SUPABASE_URL}/functions/v1/resend-activation-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify({ handle }),
    });
  } catch (err) {
    console.error("[activate-resend] request failed:", (err as Error).message);
    return redirect("/activate?state=error", clearResendCookie());
  }

  // Always the same outcome message — never reveals whether the handle was
  // still valid. The cookie is cleared either way (single use).
  return redirect("/activate?state=resent", clearResendCookie());
};

export { handler };
