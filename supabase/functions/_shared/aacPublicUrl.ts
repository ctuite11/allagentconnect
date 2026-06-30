// Hard-pinned public URL for ALL agent-side email CTAs.
// Do NOT replace with PUBLIC_SITE_URL — that env var can resolve to
// directconnectmls.com (the buyer/consumer host), which breaks agent flows.
// Buyer/DCMLS consumer emails must NOT import this constant.
export const AAC_PUBLIC_URL = "https://allagentconnect.com";

/**
 * RFC 4648 base64url encode (no padding). Used to wrap Supabase recovery
 * action links inside an AAC-branded redirect URL so the visible CTA host
 * stays `allagentconnect.com`.
 */
function base64UrlEncode(input: string): string {
  const b64 = btoa(unescape(encodeURIComponent(input)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Wrap a Supabase auth action link (recovery/magic link) inside the AAC
 * `/auth/setup` redirector so the CTA the user sees is on
 * `allagentconnect.com`. The AuthSetupRedirect page decodes `next` and
 * forwards to the underlying *.supabase.co verify URL.
 */
export function wrapSupabaseActionLinkForAac(actionLink: string): string {
  return `${AAC_PUBLIC_URL}/auth/setup?next=${base64UrlEncode(actionLink)}`;
}

/**
 * Validate an optional caller-provided CTA URL. Only `allagentconnect.com`
 * (and subdomains) are accepted; anything else falls back to the pinned
 * default. Returns an absolute URL string.
 */
export function resolveAacCtaUrl(
  candidate: string | undefined | null,
  fallbackPath: string = "/auth",
): string {
  const path = fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`;
  const fallback = `${AAC_PUBLIC_URL}${path}`;
  const raw = typeof candidate === "string" ? candidate.trim() : "";
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (host === "allagentconnect.com" || host.endsWith(".allagentconnect.com")) {
      return u.toString();
    }
    // Supabase auth action links (recovery, magic link) live on *.supabase.co.
    // Wrap them so the visible CTA stays on allagentconnect.com while still
    // forwarding to the real verify URL.
    if (host.endsWith(".supabase.co")) {
      return wrapSupabaseActionLinkForAac(u.toString());
    }
    console.warn(`[aacPublicUrl] rejected non-AAC ctaUrl host: ${host}`);
    return fallback;
  } catch {
    console.warn("[aacPublicUrl] rejected malformed ctaUrl");
    return fallback;
  }
}

/**
 * Canonical base URL resolver for OUTBOUND EMAIL LINKS.
 *
 * Always returns an absolute URL with NO trailing slash. Defaults to
 * `AAC_PUBLIC_URL`. An env-provided candidate may override the default for
 * future staging environments, but localhost, loopback, *.local, Lovable
 * preview hosts, and malformed URLs are rejected and replaced with
 * `AAC_PUBLIC_URL` so a dev/preview hostname can never leak into a
 * production email.
 *
 * Do NOT pass `req.headers.get("origin")` into this — the request origin is
 * not a safe source for outbound email URLs.
 */
export function resolveEmailBaseUrl(candidate?: string | null): string {
  const raw = typeof candidate === "string" ? candidate.trim() : "";
  if (!raw) return AAC_PUBLIC_URL;
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    console.warn("[resolveEmailBaseUrl] rejected malformed URL, using AAC_PUBLIC_URL");
    return AAC_PUBLIC_URL;
  }
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local");
  const isPreview =
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com");
  if (isLocal || isPreview) {
    console.warn(`[resolveEmailBaseUrl] rejected non-production host: ${host}`);
    return AAC_PUBLIC_URL;
  }
  return raw.replace(/\/+$/, "");
}