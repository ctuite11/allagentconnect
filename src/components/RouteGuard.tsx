import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "./LoadingScreen";
import { authDebug } from "@/lib/authDebug";

type Props = {
  children: React.ReactElement;
  requireAuth?: boolean;
  requireRole?: "agent" | "admin";
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
    if (user && requireRole && role && role !== requireRole && role !== "admin") {
      if (role === "agent") {
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
      if (location.pathname === "/pending-verification") {
        setVerificationChecked(true);
        return;
      }

      if (isVerifiedAgent) {
        setIsVerified(true);
      } else {
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

  // loading is false + no user → effect already fired navigate("/auth"); render null to avoid flash
  if (requireAuth && !user) {
    return null;
  }

  // Admin bypasses all checks
  if (isAdmin) {
    return children;
  }

  // Role mismatch — navigated in effect
  if (requireRole && role && user && role !== requireRole && role !== "admin") {
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
