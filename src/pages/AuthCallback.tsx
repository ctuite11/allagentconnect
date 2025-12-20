import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const didNavigate = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // PRIORITY 1: Detect recovery context FIRST - before any other logic
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const typeFromHash = hashParams.get('type');
    const typeFromQuery = searchParams.get('type');
    const isRecoveryContext = typeFromHash === 'recovery' || typeFromQuery === 'recovery';
    
    // Check for error in URL hash
    const errorParam = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');
    
    if (errorParam) {
      console.error("[AuthCallback] Hash error:", errorParam, errorDescription);
      setError(errorDescription || errorParam);
      return;
    }

    const hasAuthHash = window.location.hash.includes('access_token');

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[AuthCallback] Auth event:", event, "isRecovery:", isRecoveryContext, !!session);
        
        // Handle password recovery - MUST redirect to password reset page
        // Check both the event AND the URL context (type=recovery)
        if ((event === 'PASSWORD_RECOVERY' || isRecoveryContext) && session?.user) {
          if (!didNavigate.current) {
            didNavigate.current = true;
            console.log("[AuthCallback] Recovery detected - navigating to password-reset");
            window.history.replaceState(null, '', window.location.pathname);
            navigate('/password-reset', { replace: true });
          }
          return;
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Double-check: if this is a recovery context, go to password reset
          if (isRecoveryContext) {
            if (!didNavigate.current) {
              didNavigate.current = true;
              console.log("[AuthCallback] SIGNED_IN but recovery context - navigating to password-reset");
              window.history.replaceState(null, '', window.location.pathname);
              navigate('/password-reset', { replace: true });
            }
            return;
          }
          
          // Clear the hash to prevent re-processing on refresh
          window.history.replaceState(null, '', window.location.pathname);
          
          if (!didNavigate.current) {
            setTimeout(() => {
              routeUser(session.user.id);
            }, 0);
          }
        }
      }
    );

    // Check for existing session (for cases where user is already logged in)
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user && !didNavigate.current) {
        await routeUser(session.user.id);
      } else if (!session && !hasAuthHash) {
        // No session and no hash to process - go to auth
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/auth", { replace: true });
        }
      }
      // If there's a hash with access_token, wait for onAuthStateChange to process it
    };

    let timeout: NodeJS.Timeout | undefined;

    if (hasAuthHash) {
      // Hash present - SDK should auto-process, timeout after 5 seconds
      timeout = setTimeout(() => {
        if (!didNavigate.current) {
          setError("Authentication timed out. Please try signing in again.");
        }
      }, 5000);
    } else {
      checkExistingSession();
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

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

  // Error state UI
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Authentication Failed</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate("/auth", { replace: true })}>
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
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
