/**
 * Shared-listing guest mode.
 *
 * When an unauthenticated visitor lands on /property/:id from a shared link
 * (Facebook, Twitter, LinkedIn, WhatsApp, email, copy-link, etc.), we mark the
 * session as "guest mode" with that listing id. Any navigation away from that
 * specific listing is gated with a Create-Account / Log-In teaser instead of
 * exposing the rest of the network.
 *
 * Cleared on successful sign-in / sign-up.
 */

const GUEST_KEY = "aac_shared_listing_guest";
const POST_AUTH_REDIRECT_KEY = "aac_post_auth_redirect";

function safeSession(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getGuestListingId(): string | null {
  const ss = safeSession();
  if (!ss) return null;
  const v = ss.getItem(GUEST_KEY);
  return v && v.length > 0 ? v : null;
}

/**
 * Set the allowed listing id for the current guest session.
 * Does NOT overwrite an existing value — the first shared listing wins.
 */
export function setGuestListingIdIfAbsent(listingId: string): void {
  const ss = safeSession();
  if (!ss) return;
  if (!listingId) return;
  const existing = ss.getItem(GUEST_KEY);
  if (existing && existing.length > 0) return;
  ss.setItem(GUEST_KEY, listingId);
}

export function clearGuestListing(): void {
  const ss = safeSession();
  if (!ss) return;
  ss.removeItem(GUEST_KEY);
  ss.removeItem(POST_AUTH_REDIRECT_KEY);
}

/** Stash the path the guest wanted to reach so post-auth can route there. */
export function setPostAuthRedirect(path: string): void {
  const ss = safeSession();
  if (!ss) return;
  if (!path || !path.startsWith("/") || path.startsWith("//")) return;
  ss.setItem(POST_AUTH_REDIRECT_KEY, path);
}

export function consumePostAuthRedirect(): string | null {
  const ss = safeSession();
  if (!ss) return null;
  const v = ss.getItem(POST_AUTH_REDIRECT_KEY);
  if (v) ss.removeItem(POST_AUTH_REDIRECT_KEY);
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}