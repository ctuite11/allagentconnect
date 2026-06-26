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

/**
 * Resolve the post-auth destination: prefer the explicit `returnTo` query
 * param, fall back to any sessionStorage value the guest gate stashed.
 * Always clears both side effects (storage + nothing else) so the next call
 * returns null. Returns null if no safe internal path was found.
 */
export function resolvePostAuthRedirect(
  searchParams: URLSearchParams | null,
): string | null {
  const fromQuery = searchParams?.get("returnTo") ?? null;
  const stashed = consumePostAuthRedirect();
  const candidate = fromQuery && fromQuery.length > 0 ? fromQuery : stashed;
  if (!candidate) return null;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;
  return candidate;
}

/**
 * Allow-list of public paths a pending/unverified agent may bounce to via
 * `returnTo` instead of being trapped on /pending-verification. Anything not
 * in this list falls through to the normal role-based routing.
 */
const PUBLIC_RETURN_PREFIXES = [
  "/property/",
  "/search",
  "/browse",
  "/listing-results",
  "/our-agents",
  "/agents",
  "/find-agent",
  "/about",
  "/contact",
  "/blog",
  "/privacy",
  "/terms",
  "/cookies",
  "/fair-housing",
  "/disclosures",
  "/agent-rules",
];

export function isPublicReturnTo(path: string | null | undefined): boolean {
  if (!path) return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  // Strip query/hash for prefix check.
  const cleanPath = path.split(/[?#]/)[0];
  if (cleanPath === "/") return true;
  return PUBLIC_RETURN_PREFIXES.some(
    (p) => cleanPath === p || cleanPath.startsWith(p),
  );
}