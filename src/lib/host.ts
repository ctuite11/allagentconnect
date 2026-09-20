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

/**
 * Returns true when the current request is being served on a DCMLS domain,
 * or when the `?dcmls=1` query override is present (for previewing on
 * allagentconnect.lovable.app, localhost, etc.).
 *
 * Safe to call during SSR — returns false when `window` is unavailable.
 */
/** True only on the live directconnectmls.com host (not the ?dcmls=1 preview override). */
export function isLiveDcmlsHost(): boolean {
  if (typeof window === "undefined") return false;
  return DCMLS_HOSTS.has(window.location.hostname.toLowerCase());
}

export function isDcmlsHost(): boolean {
  if (typeof window === "undefined") return false;

  if (isLiveDcmlsHost()) return true;

  const params = new URLSearchParams(window.location.search);
  if (params.get("dcmls") === "1") return true;

  return false;
}
