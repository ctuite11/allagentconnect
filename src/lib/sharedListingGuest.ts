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

type PostAuthRedirectSource = "query" | "sessionStorage" | null;

export interface PostAuthRedirectResolution {
  value: string | null;
  source: PostAuthRedirectSource;
  rejectedValue: string | null;
  rejectedSource: PostAuthRedirectSource;
}

const BLOCKED_POST_AUTH_PATHS = new Set([
  "/pending-verification",
  "/access-error",
  "/auth",
  "/auth/callback",
]);

function sanitizePostAuthRedirectCandidate(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;

  const cleanPath = path.split(/[?#]/)[0];
  if (BLOCKED_POST_AUTH_PATHS.has(cleanPath)) return null;
  return path;
}

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
  if (!sanitizePostAuthRedirectCandidate(path)) return;
  ss.setItem(POST_AUTH_REDIRECT_KEY, path);
}

export function consumePostAuthRedirect(): string | null {
  const ss = safeSession();
  if (!ss) return null;
  const v = ss.getItem(POST_AUTH_REDIRECT_KEY);
  if (v) ss.removeItem(POST_AUTH_REDIRECT_KEY);
  return sanitizePostAuthRedirectCandidate(v);
}

export function resolvePostAuthRedirectWithMeta(
  searchParams: URLSearchParams | null,
): PostAuthRedirectResolution {
  const fromQuery = searchParams?.get("returnTo") ?? null;
  const ss = safeSession();
  const stashed = ss?.getItem(POST_AUTH_REDIRECT_KEY) ?? null;
  if (stashed) ss?.removeItem(POST_AUTH_REDIRECT_KEY);
  let rejectedValue: string | null = null;
  let rejectedSource: PostAuthRedirectSource = null;

  const candidates: Array<{ value: string | null; source: Exclude<PostAuthRedirectSource, null> }> = [
    { value: fromQuery, source: "query" },
    { value: stashed, source: "sessionStorage" },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) continue;
    const sanitized = sanitizePostAuthRedirectCandidate(candidate.value);
    if (sanitized) {
      return {
        value: sanitized,
        source: candidate.source,
        rejectedValue,
        rejectedSource,
      };
    }

    rejectedValue ??= candidate.value;
    rejectedSource ??= candidate.source;
  }

  return { value: null, source: null, rejectedValue, rejectedSource };
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
  return resolvePostAuthRedirectWithMeta(searchParams).value;
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