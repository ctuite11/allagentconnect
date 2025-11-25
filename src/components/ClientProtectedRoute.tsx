import { useEffect, useState } from "react";
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

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/consumer/auth" state={{ from: location }} replace />;
  }

  if (role === "agent") {
    return <Navigate to="/agent-dashboard" replace />;
  }

  if (role !== "buyer") {
    return <Navigate to="/consumer/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
