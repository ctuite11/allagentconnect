import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "./LoadingScreen";
import { authDebug } from "@/lib/authDebug";
import { setPostAuthRedirect } from "@/lib/sharedListingGuest";
import { getRouteForRole, type ResolvedRole } from "@/lib/resolveUserRole";
import { Button } from "@/components/ui/button";

type AllowedRole = "agent" | "admin" | "buyer" | "developer";

type Props = {
  children: React.ReactElement;
  requireAuth?: boolean;
  requireRole?: AllowedRole | AllowedRole[];
  requireVerified?: boolean;
};

function homeForRole(role: ResolvedRole | null): string {
  if (!role || role === "unknown") return "/auth";
  return getRouteForRole({
    role,
    is_verified_agent: false,
    can_access_success_hub: role === "agent" || role === "delegate",
  });
}

export const RouteGuard: React.FC<Props> = ({
  children,
  requireAuth = true,
  requireRole,
  /** Agent routes require verified license status unless explicitly disabled. */
  requireVerified = true,
}) => {
  const { user, role, loading, isAdmin, isVerifiedAgent, isDelegate, canAccessSuccessHub } =
    useAuthRole();
  const location = useLocation();
  const navigate = useNavigate();

  // Admins bypass all agent verification checks
  const shouldVerify = requireRole === "agent" && !isAdmin && requireVerified;

  const [verificationChecked, setVerificationChecked] = useState(!shouldVerify);
  const [isVerified, setIsVerified] = useState(false);
  const [stuck, setStuck] = useState(false);

  // Last-resort escape hatch: if auth/role resolution never settles (stalled
  // Supabase auth lock on mobile), show recovery actions instead of an
  // infinite "Checking your session..." spinner.
  useEffect(() => {
    if (!loading) {
      setStuck(false);
      return;
    }
    const t = window.setTimeout(() => setStuck(true), 10000);
    return () => window.clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (loading) return;

    authDebug("RouteGuard", {
      pathname: location.pathname,
      userId: user?.id,
      role,
      isAdmin,
      isVerifiedAgent,
      requireRole,
      requireVerified,
      shouldVerify,
    });

    // Route requires auth but no user → login
    if (requireAuth && !user) {
      if (location.pathname !== "/auth" && location.pathname !== "/developer-login") {
        // Preserve the full intended destination (path + query, e.g. the
        // stale-listing reminder's ?ref=stale-reminder&confirm=1) so /auth
        // returns the agent to the editor instead of the default dashboard.
        const intended = `${location.pathname}${location.search}`;
        setPostAuthRedirect(intended);
        const loginPath = location.pathname.startsWith("/developer")
          ? `/developer-login?returnTo=${encodeURIComponent(intended)}`
          : `/auth?returnTo=${encodeURIComponent(intended)}`;
        navigate(loginPath, {
          replace: true,
          state: { from: intended },
        });
      }
      return;
    }

    // PRIORITY 1: Admin users bypass all route restrictions
    if (isAdmin) {
      authDebug("RouteGuard", { action: "admin_bypass", pathname: location.pathname });
      setVerificationChecked(true);
      setIsVerified(true);
      return;
    }

    // Developers never enter agent verification / Success Hub flows.
    if (role === "developer" && requireRole === "agent") {
      navigate("/developer", { replace: true });
      return;
    }

    // Role mismatch → route to correct product home
    const agentAccess = requireRole === "agent" && (role === "agent" || role === "delegate");
    const roleAllowed = agentAccess
      ? true
      : Array.isArray(requireRole)
        ? requireRole.includes(role as AllowedRole)
        : role === requireRole;
    if (user && requireRole && role && !roleAllowed && role !== "admin") {
      navigate(homeForRole(role), { replace: true });
      return;
    }

    // Verification gate — uses isVerifiedAgent from the single RPC (no extra query)
    if (shouldVerify && user && requireRole === "agent") {
      if (role === "delegate") {
        setIsVerified(true);
        setVerificationChecked(true);
        return;
      }

      if (location.pathname === "/pending-verification") {
        setVerificationChecked(true);
        return;
      }

      // Only act on a CONFIRMED resolved role. If role is null/unknown
      // (resolver still loading or returned unknown), do NOT redirect to
      // /pending-verification — show the loading screen instead.
      if (role !== "agent") {
        if (import.meta.env.DEV) {
          console.info("[ROUTE_GUARD] waiting for role", {
            pathname: location.pathname,
            userId: user.id,
            role,
            isAdmin,
            isVerifiedAgent,
          });
        }
        return;
      }

      if (isVerifiedAgent || canAccessSuccessHub) {
        setIsVerified(true);
      } else {
        if (import.meta.env.DEV) {
          console.info("[ROUTE_GUARD] agent not verified → /pending-verification", {
            pathname: location.pathname,
            userId: user.id,
          });
        }
        navigate("/pending-verification", { replace: true });
        return;
      }
      setVerificationChecked(true);
    } else if (!shouldVerify) {
      setVerificationChecked(true);
      setIsVerified(true);
    }
  }, [
    loading,
    user,
    role,
    isAdmin,
    isVerifiedAgent,
    isDelegate,
    canAccessSuccessHub,
    requireAuth,
    requireRole,
    shouldVerify,
    location.pathname,
    location.search,
    navigate,
  ]);

  if (loading) {
    if (stuck) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
          <p className="text-sm text-muted-foreground">
            We're having trouble confirming your session.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button variant="outline" onClick={() => window.location.assign("/auth?logout=1")}>
              Sign in again
            </Button>
          </div>
        </div>
      );
    }
    return <LoadingScreen message="Checking your session..." />;
  }

  // loading is false + no user → effect fired navigate("/auth"); show neutral placeholder, not a blank white screen
  if (requireAuth && !user) {
    if (location.pathname !== "/auth" && location.pathname !== "/developer-login") {
      return <LoadingScreen message="Redirecting..." />;
    }
    return null;
  }

  // Admin bypasses all checks
  if (isAdmin) {
    return children;
  }

  // Role mismatch — navigated in effect
  const roleMatchesRender =
    requireRole === "agent"
      ? role === "agent" || role === "delegate"
      : Array.isArray(requireRole)
        ? requireRole.includes(role as AllowedRole)
        : role === requireRole;
  if (requireRole && role && user && !roleMatchesRender && role !== "admin") {
    return null;
  }

  if (shouldVerify && !verificationChecked) {
    return <LoadingScreen message="Verifying access..." />;
  }

  if (shouldVerify && !isVerified && verificationChecked) {
    return null; // Already navigating
  }

  return children;
};
