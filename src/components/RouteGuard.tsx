import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "./LoadingScreen";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  children: React.ReactElement;
  requireAuth?: boolean;
  requireRole?: "agent" | "buyer";
  requireVerified?: boolean;
};

export const RouteGuard: React.FC<Props> = ({
  children,
  requireAuth = true,
  requireRole,
  requireVerified = false,
}) => {
  const { user, role, loading } = useAuthRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [verificationChecked, setVerificationChecked] = useState(!requireVerified);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (loading) return;

    // If route requires auth and no user, send to login
    if (requireAuth && !user) {
      if (location.pathname !== "/consumer/auth" && location.pathname !== "/auth") {
        navigate("/consumer/auth", {
          replace: true,
          state: { from: location.pathname },
        });
      }
      return;
    }

    // If we have a user and a required role, but it doesn't match, route to correct dashboard
    if (user && requireRole && role && role !== requireRole) {
      if (role === "agent") {
        navigate("/agent-dashboard", { replace: true });
      } else if (role === "buyer") {
        navigate("/client/dashboard", { replace: true });
      }
      return;
    }

    // Check verification if required
    if (requireVerified && user && requireRole === "agent") {
      checkVerification(user.id);
    }
  }, [loading, user, role, requireAuth, requireRole, requireVerified, location.pathname, navigate]);

  const checkVerification = async (userId: string) => {
    try {
      const { data: settings } = await supabase
        .from('agent_settings')
        .select('agent_status')
        .eq('user_id', userId)
        .maybeSingle();

      const status = settings?.agent_status || 'unverified';

      if (status === 'verified') {
        setIsVerified(true);
      } else {
        // Not verified - redirect to license verification
        navigate('/onboarding/verify-license', { replace: true });
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

  // If role mismatch, we've already navigated; render nothing
  if (requireRole && role && user && role !== requireRole) {
    return null;
  }

  // If verification required but not yet checked
  if (requireVerified && !verificationChecked) {
    return <LoadingScreen message="Verifying access..." />;
  }

  // If verification required but not verified
  if (requireVerified && !isVerified && verificationChecked) {
    return null; // Already navigating
  }

  return children;
};
