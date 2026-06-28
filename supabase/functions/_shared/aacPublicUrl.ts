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