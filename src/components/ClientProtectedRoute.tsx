import { useEffect, useState } from "react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Session } from "@supabase/supabase-js";

interface ClientProtectedRouteProps {
  children: React.ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
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
    return <AacMonogramLoader variant="fullscreen" />;
  }

  // No session = not logged in, redirect to consumer auth
  if (!session) {
    return <Navigate to="/consumer/auth" state={{ from: location }} replace />;
  }

  // User is logged in, now check role
  if (role === "agent") {
    // Confirmed agent, send to agent dashboard
    return <Navigate to="/agent-dashboard" replace />;
  }

  if (role === "buyer") {
    // Confirmed buyer, allow access
    return <>{children}</>;
  }

  // User exists but role is null - treat as buyer (they were likely invited as a client)
  // This handles edge cases where role hasn't been assigned yet
  console.log("User has no role, treating as buyer");
  return <>{children}</>;
}
