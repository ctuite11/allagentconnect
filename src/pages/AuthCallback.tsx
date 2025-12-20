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
    const typeFromHash = hashParams.get("type");
    const typeFromQuery = searchParams.get("type");
    const code = searchParams.get("code");

    // STRICT recovery detection: ONLY type=recovery (NOT tokens - breaks email confirm)
    const isRecoveryContext =
      typeFromHash === "recovery" ||
      typeFromQuery === "recovery";

    // Check for error in URL hash
    const errorParam = hashParams.get("error");
    const errorDescription = hashParams.get("error_description");

    if (errorParam) {
      console.error("[AuthCallback] Hash error:", errorParam, errorDescription);
      setError(errorDescription || errorParam);
      return;
    }

    const hasAuthHash = window.location.hash.includes("access_token");

    let timeout: NodeJS.Timeout | undefined;
    let subscription: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    const init = async () => {
      // If this is a PKCE recovery link (?code=...), establish session FIRST.
      if (code) {
        console.log("[AuthCallback] PKCE code detected - exchanging for session");

        try {
          await supabase.auth.exchangeCodeForSession(code);

          if (!cancelled && !didNavigate.current) {
            didNavigate.current = true;
            window.history.replaceState(null, "", window.location.pathname);
            navigate("/password-reset", { replace: true });
          }
          return;
        } catch (err) {
          console.error("[AuthCallback] PKCE exchange error:", err);
          if (!cancelled) {
            setError("Reset link expired or invalid. Please request a new one.");
          }
          return;
        }
      }

      // Set up auth state listener
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        console.log(
          "[AuthCallback] Auth event:",
          event,
          "isRecovery:",
          isRecoveryContext,
          !!session
        );

        // Handle password recovery - MUST redirect to password reset page
        if ((event === "PASSWORD_RECOVERY" || isRecoveryContext) && session?.user) {
          if (!didNavigate.current) {
            didNavigate.current = true;
            console.log(
              "[AuthCallback] Recovery detected - navigating to password-reset"
            );
            window.history.replaceState(null, "", window.location.pathname);
            navigate("/password-reset", { replace: true });
          }
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          // Double-check: if this is a recovery context, go to password reset
          if (isRecoveryContext) {
            if (!didNavigate.current) {
              didNavigate.current = true;
              console.log(
                "[AuthCallback] SIGNED_IN but recovery context - navigating to password-reset"
              );
              window.history.replaceState(null, "", window.location.pathname);
              navigate("/password-reset", { replace: true });
            }
            return;
          }

          // Clear the hash to prevent re-processing on refresh
          window.history.replaceState(null, "", window.location.pathname);

          if (!didNavigate.current) {
            setTimeout(() => {
              routeUser(session.user.id);
            }, 0);
          }
        }
      });

      subscription = data.subscription;

      // Check for existing session (for cases where user is already logged in)
      const checkExistingSession = async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

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
    };

    void init();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, [navigate, searchParams]);

  const routeUser = async (userId: string) => {
    if (didNavigate.current) return;

    try {
      // Get session first
      const { data: { session } } = await supabase.auth.getSession();
      
      // CRITICAL: Check if this is a recovery session - NEVER route to onboarding
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlParams = new URLSearchParams(window.location.search);
      
      const isRecoverySession =
        !!session?.user?.recovery_sent_at ||
        hashParams.get("type") === "recovery" ||
        urlParams.get("type") === "recovery";
      
      if (isRecoverySession) {
        console.log("[AuthCallback] Recovery session detected - redirecting to password-reset");
        didNavigate.current = true;
        navigate('/password-reset', { replace: true });
        return;
      }

      // 1. Check existing role in user_roles table
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      // If user already has a role, route based on that
      if (userRole?.role) {
        didNavigate.current = true;
        if (userRole.role === 'buyer') {
          navigate('/client/dashboard', { replace: true });
        } else if (userRole.role === 'agent') {
          // Check agent verification status
          const { data: settings } = await supabase
            .from('agent_settings')
            .select('agent_status')
            .eq('user_id', userId)
            .maybeSingle();

          const status = settings?.agent_status || 'unverified';
          if (status === 'verified') {
            navigate('/agent-dashboard', { replace: true });
          } else {
            // Check if they have a profile
            const { data: agentProfile } = await supabase
              .from('agent_profiles')
              .select('id')
              .eq('id', userId)
              .maybeSingle();

            if (!agentProfile) {
              navigate('/onboarding/create-account', { replace: true });
            } else {
              navigate('/onboarding/verify-license', { replace: true });
            }
          }
        } else if (userRole.role === 'admin') {
          navigate('/admin/approvals', { replace: true });
        }
        return;
      }

      // 2. No role yet - check intended_role from user metadata
      const intendedRole = session?.user?.user_metadata?.intended_role;
      console.log("[AuthCallback] No role found, intended_role:", intendedRole);

      if (intendedRole === 'buyer') {
        // Assign buyer role
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: 'buyer' }, { onConflict: 'user_id' });

        if (roleError) {
          console.error("[AuthCallback] Failed to assign buyer role:", roleError);
        }

        didNavigate.current = true;
        navigate('/client/dashboard', { replace: true });
        return;
      }

      // Default: treat as agent - go to onboarding
      // Check if agent_profiles exists
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
