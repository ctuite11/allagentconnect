import React from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "./LoadingScreen";

type Props = {
  children: React.ReactElement;
  requireAuth?: boolean;
  requireRole?: "agent" | "buyer";
};

export const RouteGuard: React.FC<Props> = ({
  children,
  requireAuth = true,
  requireRole,
}) => {
  const { user, role, loading } = useAuthRole();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return; // DO NOTHING WHILE LOADING

    // If route requires auth and no user, send to login ONCE
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
    }
  }, [loading, user, role, requireAuth, requireRole, location.pathname, navigate]);

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

  return children;
};
