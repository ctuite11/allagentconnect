// Hard-pinned public URL for ALL agent-side email CTAs.
// Do NOT replace with PUBLIC_SITE_URL — that env var can resolve to
// directconnectmls.com (the buyer/consumer host), which breaks agent flows.
// Buyer/DCMLS consumer emails must NOT import this constant.
export const AAC_PUBLIC_URL = "https://allagentconnect.com";

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
    console.warn(`[aacPublicUrl] rejected non-AAC ctaUrl host: ${host}`);
    return fallback;
  } catch {
    console.warn("[aacPublicUrl] rejected malformed ctaUrl");
    return fallback;
  }
}