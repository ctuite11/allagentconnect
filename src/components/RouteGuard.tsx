import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "./LoadingScreen";
import { authDebug } from "@/lib/authDebug";
import { setPostAuthRedirect } from "@/lib/sharedListingGuest";

type AllowedRole = "agent" | "admin" | "buyer";

type Props = {
  children: React.ReactElement;
  requireAuth?: boolean;
  requireRole?: AllowedRole | AllowedRole[];
  requireVerified?: boolean;
};

export const RouteGuard: React.FC<Props> = ({
  children,
  requireAuth = true,
  requireRole,
  /** Agent routes require verified license status unless explicitly disabled. */
  requireVerified = true,
}) => {
  const { user, role, loading, isAdmin, isVerifiedAgent, isDelegate, canAccessSuccessHub } = useAuthRole();
  const location = useLocation();
  const navigate = useNavigate();

  // Admins bypass all agent verification checks
  const shouldVerify = requireRole === "agent" && !isAdmin && requireVerified;

  const [verificationChecked, setVerificationChecked] = useState(!shouldVerify);
  const [isVerified, setIsVerified] = useState(false);

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
      if (location.pathname !== "/auth") {
        // Preserve the full intended destination (path + query, e.g. the
        // stale-listing reminder's ?ref=stale-reminder&confirm=1) so /auth
        // returns the agent to the editor instead of the default dashboard.
        const intended = `${location.pathname}${location.search}`;
        setPostAuthRedirect(intended);
        navigate(`/auth?returnTo=${encodeURIComponent(intended)}`, {
          replace: true,
          // Keep pathname + search so any consumer of location.state.from
          // sees the same destination as ?returnTo= / sessionStorage.
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

    // Role mismatch → route to correct dashboard
    const agentAccess = requireRole === "agent" && (role === "agent" || role === "delegate");
    const roleAllowed = agentAccess
      ? true
      : Array.isArray(requireRole)
        ? requireRole.includes(role as AllowedRole)
        : role === requireRole;
    if (user && requireRole && role && !roleAllowed && role !== "admin") {
      if (role === "agent" || role === "delegate") {
        navigate("/agent-dashboard", { replace: true });
      } else if (role === "buyer") {
        navigate("/client/dashboard", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
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
  }, [loading, user, role, isAdmin, isVerifiedAgent, isDelegate, canAccessSuccessHub, requireAuth, requireRole, shouldVerify, location.pathname, navigate]);

  if (loading) {
    return <LoadingScreen message="Checking your session..." />;
  }

  // loading is false + no user → effect fired navigate("/auth"); show neutral placeholder, not a blank white screen
  if (requireAuth && !user) {
    if (location.pathname !== "/auth") {
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
