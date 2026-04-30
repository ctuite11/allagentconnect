import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "./LoadingScreen";
import { authDebug } from "@/lib/authDebug";

type AllowedRole = "agent" | "admin" | "buyer";

const dbgRouteGuard = (msg: string, data?: Record<string, unknown>) => {
  if (import.meta.env.DEV) console.log("[AAC_DEBUG RouteGuard]", msg, data ?? {});
};

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
  requireVerified = false,
}) => {
  const { user, role, loading, isAdmin, isVerifiedAgent } = useAuthRole();
  const location = useLocation();
  const navigate = useNavigate();

  // Admins bypass all agent verification checks
  const shouldVerify = requireRole === "agent" && !isAdmin ? (requireVerified !== false) : false;

  const [verificationChecked, setVerificationChecked] = useState(!shouldVerify);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (loading) {
      dbgRouteGuard("effect:skip (auth still loading)", { pathname: location.pathname });
      return;
    }

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
        dbgRouteGuard("navigate → /auth (requireAuth, no user)", {
          from: location.pathname,
          requireRole: requireRole ?? null,
        });
        navigate("/auth", { replace: true, state: { from: location.pathname } });
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
    const roleAllowed = Array.isArray(requireRole) ? requireRole.includes(role as AllowedRole) : role === requireRole;
    if (user && requireRole && role && !roleAllowed && role !== "admin") {
      if (role === "agent") {
        dbgRouteGuard("navigate → /agent-dashboard (role mismatch)", {
          pathname: location.pathname,
          requireRole,
          role,
        });
        navigate("/agent-dashboard", { replace: true });
      } else if (role === "buyer") {
        dbgRouteGuard("navigate → /client/dashboard (role mismatch)", {
          pathname: location.pathname,
          requireRole,
          role,
        });
        navigate("/client/dashboard", { replace: true });
      } else {
        dbgRouteGuard("navigate → /auth (role mismatch, unknown role)", {
          pathname: location.pathname,
          requireRole,
          role,
        });
        navigate("/auth", { replace: true });
      }
      return;
    }

    // Verification gate — uses isVerifiedAgent from the single RPC (no extra query)
    if (shouldVerify && user && requireRole === "agent") {
      if (location.pathname === "/pending-verification") {
        setVerificationChecked(true);
        return;
      }

      if (isVerifiedAgent) {
        setIsVerified(true);
      } else {
        dbgRouteGuard("navigate → /pending-verification (agent unverified)", {});
        navigate("/pending-verification", { replace: true });
        return;
      }
      setVerificationChecked(true);
    } else if (!shouldVerify) {
      setVerificationChecked(true);
      setIsVerified(true);
    }
  }, [loading, user, role, isAdmin, isVerifiedAgent, requireAuth, requireRole, shouldVerify, location.pathname, navigate]);

  if (loading) {
    return <LoadingScreen message="Checking your session..." />;
  }

  // loading is false + no user → effect fired navigate("/auth"); show neutral placeholder, not a blank white screen
  if (requireAuth && !user) {
    dbgRouteGuard("render → Redirecting/no user overlay", {
      pathname: location.pathname,
    });
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
  const roleMatchesRender = Array.isArray(requireRole) ? requireRole.includes(role as AllowedRole) : role === requireRole;
  if (requireRole && role && user && !roleMatchesRender && role !== "admin") {
    dbgRouteGuard("render: null (role mismatch pending redirect)", {
      pathname: location.pathname,
      requireRole,
      role,
    });
    return null;
  }

  if (shouldVerify && !verificationChecked) {
    return <LoadingScreen message="Verifying access..." />;
  }

  if (shouldVerify && !isVerified && verificationChecked) {
    dbgRouteGuard("render: null (agent verify pending)", { pathname: location.pathname });
    return null; // Already navigating
  }

  dbgRouteGuard("render: children (guards passed)", {
    pathname: location.pathname,
    requireRole: requireRole ?? null,
    role,
    userId: user?.id ?? null,
  });
  return children;
};
