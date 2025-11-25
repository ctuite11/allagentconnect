import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Session } from "@supabase/supabase-js";

interface AgentProtectedRouteProps {
  children: React.ReactNode;
}

export function AgentProtectedRoute({ children }: AgentProtectedRouteProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { role, loading: roleLoading } = useUserRole(session?.user || null);

  // Show loading state while auth or role data is being fetched
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // No session = not logged in, redirect to auth
  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // User is logged in, now check role
  if (role === "buyer") {
    // Confirmed buyer, send to client dashboard
    return <Navigate to="/client/dashboard" replace />;
  }

  if (role === "agent") {
    // Confirmed agent, allow access
    return <>{children}</>;
  }

  // User exists but role is null (should not happen after backfill, but handle gracefully)
  // Treat as unauthorized and redirect to auth
  console.warn("User has no role assigned, redirecting to auth");
  return <Navigate to="/auth" state={{ from: location }} replace />;
}
