import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "./LoadingScreen";
import { supabase } from "@/integrations/supabase/client";
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
  const { user, role, loading, isAdmin } = useAuthRole();
  const location = useLocation();
  const navigate = useNavigate();
  
  // CRITICAL: Admins NEVER need verification - they bypass all agent verification checks
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
      requireRole,
      requireVerified,
      shouldVerify
    });

    // If route requires auth and no user, send to login
    if (requireAuth && !user) {
      if (location.pathname !== "/auth") {
        navigate("/auth", {
          replace: true,
          state: { from: location.pathname },
        });
      }
      return;
    }

    // PRIORITY 1: Admin users can access ALL routes - no verification needed, no redirects
    if (isAdmin) {
      authDebug("RouteGuard", { action: "admin_bypass", pathname: location.pathname });
      setVerificationChecked(true);
      setIsVerified(true);
      return;
    }

    // If we have a user and a required role, but it doesn't match, route to correct dashboard
    if (user && requireRole && role && role !== requireRole && role !== "admin") {
      if (role === "agent") {
        navigate("/agent-dashboard", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
      return;
    }

    // Check verification if required (only for non-admin agents)
    // Skip if already on pending-verification page to prevent loops
    if (shouldVerify && user && requireRole === "agent" && location.pathname !== "/pending-verification") {
      checkVerification(user.id);
    } else if (shouldVerify && location.pathname === "/pending-verification") {
      setVerificationChecked(true);
    } else if (!shouldVerify) {
      // No verification needed (admin or not required)
      setVerificationChecked(true);
      setIsVerified(true);
    }
  }, [loading, user, role, isAdmin, requireAuth, requireRole, shouldVerify, location.pathname, navigate]);

  const checkVerification = async (userId: string) => {
    try {
      const { data: settings } = await supabase
        .from('agent_settings')
        .select('agent_status')
        .eq('user_id', userId)
        .maybeSingle();

      const status = settings?.agent_status || 'unverified';

      authDebug("RouteGuard checkVerification", { userId, status });

      if (status === 'verified') {
        setIsVerified(true);
      } else {
        // Not verified - redirect to pending verification
        navigate('/pending-verification', { replace: true });
        return;
      }
    } catch (err) {
      console.error("Verification check error:", err);
    } finally {
      setVerificationChecked(true);
    }
  };

  // While loading, show loading screen
  if (loading) {
    return <LoadingScreen message="Checking your session..." />;
  }

  // If route requires auth and no user -> we already navigated in useEffect
  if (requireAuth && !user) {
    return <LoadingScreen message="Redirecting to sign in..." />;
  }

  // Admin bypasses all checks
  if (isAdmin) {
    return children;
  }

  // If role mismatch, we've already navigated; render nothing
  if (requireRole && role && user && role !== requireRole && role !== "admin") {
    return null;
  }

  // If verification required but not yet checked
  if (shouldVerify && !verificationChecked) {
    return <LoadingScreen message="Verifying access..." />;
  }

  // If verification required but not verified
  if (shouldVerify && !isVerified && verificationChecked) {
    return null; // Already navigating
  }

  return children;
};
