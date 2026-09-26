import { isLiveDcmlsHost } from "@/lib/host";

/**
 * Temporary DCMLS auth access gate.
 *
 * Flip to `true` when consumer/agent login should return on Direct Connect MLS.
 * AAC (`allagentconnect.com`) is never affected by this flag.
 */
export const DCMLS_AUTH_ACCESS_ENABLED = false;

/** True when DCMLS login CTAs / auth routes should be available. */
export function isDcmlsAuthAccessEnabled(): boolean {
  return DCMLS_AUTH_ACCESS_ENABLED === true;
}

/**
 * Live DCMLS host only: block presenting login/auth pages.
 * Preview `?dcmls=1` is not redirected by hostname (AAC production stays untouched).
 */
export function shouldBlockDcmlsAuthRoutes(): boolean {
  return isLiveDcmlsHost() && !isDcmlsAuthAccessEnabled();
}
