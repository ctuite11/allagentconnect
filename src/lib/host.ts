/**
 * Host detection helpers for domain-aware routing.
 *
 * AAC and DCMLS share one deployment. Use these helpers to branch UI
 * (e.g. the homepage) based on the active hostname.
 */

const DCMLS_HOSTS = new Set([
  "directconnectmls.com",
  "www.directconnectmls.com",
]);

/** Production AAC hosts — must never activate DCMLS via `?dcmls=1`. */
const AAC_PRODUCTION_HOSTS = new Set([
  "allagentconnect.com",
  "www.allagentconnect.com",
]);

/**
 * Hosts where `?dcmls=1` may activate DCMLS preview mode.
 * Live DCMLS host does not need the query override.
 * AAC production hosts are explicitly excluded.
 */
function allowsDcmlsPreviewQuery(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (AAC_PRODUCTION_HOSTS.has(host)) return false;
  if (DCMLS_HOSTS.has(host)) return false; // live DCMLS is domain-based

  // localhost / loopback
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  ) {
    return true;
  }

  // Netlify deploy previews and site deploys
  if (host.endsWith(".netlify.app")) return true;

  // Lovable preview hosts
  if (host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com")) {
    return true;
  }

  return false;
}

/** True only on the live directconnectmls.com host (not the ?dcmls=1 preview override). */
export function isLiveDcmlsHost(): boolean {
  if (typeof window === "undefined") return false;
  return DCMLS_HOSTS.has(window.location.hostname.toLowerCase());
}

/**
 * Returns true when the current request should use the DCMLS consumer surface.
 *
 * - Live: `directconnectmls.com` / `www.directconnectmls.com`
 * - Preview override `?dcmls=1`: only on localhost, Netlify, Lovable — never on AAC production
 *
 * Safe to call during SSR — returns false when `window` is unavailable.
 */
export function isDcmlsHost(): boolean {
  if (typeof window === "undefined") return false;

  if (isLiveDcmlsHost()) return true;

  const host = window.location.hostname.toLowerCase();
  if (!allowsDcmlsPreviewQuery(host)) return false;

  const params = new URLSearchParams(window.location.search);
  return params.get("dcmls") === "1";
}

/**
 * True when DCMLS UX is active only via `?dcmls=1` (Netlify/local/Lovable preview),
 * not on the live directconnectmls.com hostname.
 */
export function isDcmlsPreviewOverride(): boolean {
  return isDcmlsHost() && !isLiveDcmlsHost();
}

/**
 * Consumer property path for DCMLS navigation.
 * Preview override → `/consumer-property/:id?dcmls=1&…`
 * Live DCMLS host → clean `/consumer-property/:id` (plus any extra params).
 */
export function getDcmlsConsumerPropertyPath(
  listingId: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  // Preview override first so URLs read `?dcmls=1&returnTo=…`.
  if (isDcmlsPreviewOverride()) {
    params.set("dcmls", "1");
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value);
    }
  }
  const q = params.toString();
  return q
    ? `/consumer-property/${listingId}?${q}`
    : `/consumer-property/${listingId}`;
}
