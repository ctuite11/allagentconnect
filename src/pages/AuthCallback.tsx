import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const didNavigate = useRef(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      if (didNavigate.current) return;

      try {
        // Wait for session to hydrate
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[AuthCallback] Session error:", sessionError);
          navigate("/auth", { replace: true });
          return;
        }

        if (!session) {
          // No session yet - retry after brief wait for hash processing
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          
          if (!retrySession) {
            navigate("/auth", { replace: true });
            return;
          }
          
          await routeUser(retrySession.user.id);
          return;
        }

        await routeUser(session.user.id);
      } catch (err) {
        console.error("[AuthCallback] Error:", err);
        navigate("/auth", { replace: true });
      }
    };

    const routeUser = async (userId: string) => {
      if (didNavigate.current) return;

      try {
        // 1. Check if agent_profiles exists
        const { data: agentProfile } = await supabase
          .from('agent_profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (!agentProfile) {
          // No profile - send to create account
          didNavigate.current = true;
          navigate('/onboarding/create-account', { replace: true });
          return;
        }

        // 2. Check agent_settings for verification status
        const { data: settings } = await supabase
          .from('agent_settings')
          .select('agent_status')
          .eq('user_id', userId)
          .maybeSingle();

        const status = settings?.agent_status || 'unverified';

        if (status === 'verified') {
          didNavigate.current = true;
          navigate('/agent-dashboard', { replace: true });
        } else {
          // unverified or pending - go to license verification
          didNavigate.current = true;
          navigate('/onboarding/verify-license', { replace: true });
        }
      } catch (err) {
        console.error("[AuthCallback] Route error:", err);
        didNavigate.current = true;
        navigate('/onboarding/create-account', { replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Setting up your account...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
