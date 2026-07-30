import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

import AACMonogram from "@/components/ui/AACMonogram";
import { Button } from "@/components/ui/button";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useSharedListingGuest } from "@/contexts/SharedListingGuestContext";
import { setPostAuthRedirect } from "@/lib/sharedListingGuest";

/**
 * Paths always allowed in guest mode (auth, legal, info, etc.).
 * Anything outside this set + the originally shared /property/:id is gated.
 */
const ALWAYS_ALLOWED_PREFIXES = [
  "/auth",
  "/password-reset",
  "/agent-setup",
  "/access-error",
  "/pending-verification",
  "/privacy",
  "/terms",
  "/cookies",
  "/fair-housing",
  "/disclosures",
  "/agent-rules",
  "/about",
  "/contact",
  "/blog",
  // Invite / share-link landing flows must keep working.
  "/invite/",
  "/client-invite",
  "/link/",
  "/unsubscribe-hotsheet",
];

/**
 * Path prefixes that ARE gated for guests. We use an allowlist for
 * always-allowed routes and a denylist for explicit gated routes; anything
 * else is not gated.
 */
const GATED_PREFIXES = [
  "/", // home — handled exactly below
  "/home",
  "/search",
  "/browse",
  "/listing-results",
  "/listing-search",
  "/our-agents",
  "/agents",
  "/find-agent",
  "/our-members",
  "/members",
  "/agent/",
  "/team/",
  "/property/", // other listings — exact allowed listing is filtered separately
  "/consumer-property/",
  "/favorites",
  "/my-favorites",
  "/hot-sheets",
  "/messages",
  "/communications",
  "/agent-dashboard",
  "/success-hub",
  "/client/",
  "/admin/",
  "/settings",
  "/showing-requests",
  "/analytics",
  "/market-insights",
  "/vendor/",
  "/manage-team",
  "/manage-coverage-areas",
  "/listing-intel",
];

function isAlwaysAllowed(pathname: string): boolean {
  return ALWAYS_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );
}

function isGatedPath(pathname: string): boolean {
  // Exact match for the homepage.
  if (pathname === "/") return true;
  return GATED_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(p)),
  );
}

interface SharedListingGateProps {
  children: React.ReactNode;
}

export function SharedListingGate({ children }: SharedListingGateProps) {
  const { user, loading } = useAuthRole();
  const { isGuest, allowedListingId } = useSharedListingGuest();
  const location = useLocation();

  const blocked = useMemo(() => {
    if (loading) return false;
    if (user) return false;
    if (!isGuest || !allowedListingId) return false;
    const path = location.pathname;
    if (isAlwaysAllowed(path)) return false;
    // The originally shared listing is always allowed.
    if (path === `/property/${allowedListingId}`) return false;
    if (path === `/consumer-property/${allowedListingId}`) return false;
    return isGatedPath(path);
  }, [loading, user, isGuest, allowedListingId, location.pathname]);

  if (!blocked) return <>{children}</>;

  const currentPath = `${location.pathname}${location.search}`;
  const encodedReturn = encodeURIComponent(currentPath);
  const signupHref = `/auth?mode=register&returnTo=${encodedReturn}`;
  const loginHref = `/auth?returnTo=${encodedReturn}`;
  const listingHref = `/property/${allowedListingId}`;

  const rememberRedirect = () => setPostAuthRedirect(currentPath);

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center">
          <AACMonogram className="h-14 w-14" />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          Create a free account to keep exploring
        </h1>

        <p className="mt-4 max-w-md text-base leading-relaxed text-zinc-600">
          The listing you opened is yours to view. To browse other properties,
          agents, and search results across All Agent Connect, create a free
          account or sign in — it only takes a moment.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Button asChild size="lg" className="h-12 w-full text-sm font-medium">
            <Link to={signupHref} onClick={rememberRedirect}>
              Create Account
            </Link>
          </Button>
          <Link
            to={loginHref}
            onClick={rememberRedirect}
            className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline"
          >
            Already have an account? Log in
          </Link>
        </div>

        <Link
          to={listingHref}
          className="mt-10 text-sm text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline"
        >
          ← Back to listing
        </Link>
      </div>
    </div>
  );
}

export default SharedListingGate;