import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authDebug, getAgentStatus } from "@/lib/authDebug";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const didNavigate = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const typeFromHash = hashParams.get("type");
    const typeFromQuery = searchParams.get("type");
    const code = searchParams.get("code");

    // Hash-based tokens (implicit flow)
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    // Recovery detection
    const isRecoveryContext =
      typeFromHash === "recovery" ||
      typeFromQuery === "recovery";

    // Generate a stable key to prevent double-processing
    const tokenKey =
      accessToken?.slice(0, 16) ||
      code?.slice(0, 16) ||
      "unknown";
    const processedKey = `aac_processed_${isRecoveryContext ? "recovery" : "auth"}_${tokenKey}`;

    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.log("[AuthCallback] Init:", {
        hasCode: !!code,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        isRecoveryContext,
        typeFromHash,
        typeFromQuery,
        tokenKey: tokenKey.substring(0, 8) + "..."
      });
    }

    // Check for error in URL hash
    const errorParam = hashParams.get("error");
    const errorDescription = hashParams.get("error_description");

    if (errorParam) {
      console.error("[AuthCallback] Hash error:", errorParam, errorDescription);
      setError(errorDescription || errorParam);
      return;
    }

    // CRITICAL: Check if this link was already processed (email clients prefetch)
    if (sessionStorage.getItem(processedKey)) {
      console.log("[AuthCallback] Link already processed, showing error");
      setError("This link was already used. Please request a new password reset link.");
      return;
    }

    // Mark recovery flow in sessionStorage for PasswordReset to verify
    if (isRecoveryContext) {
      sessionStorage.setItem("aac_recovery_flow", "1");
      if (import.meta.env.DEV) console.log("[AuthCallback] Recovery flow marked in sessionStorage");
    }

    const hasAuthHash = window.location.hash.includes("access_token");

    let timeout: NodeJS.Timeout | undefined;
    let subscription: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    const init = async () => {
      // Handle hash-based recovery tokens (implicit flow)
      if (accessToken && refreshToken) {
        if (import.meta.env.DEV) console.log("[AuthCallback] Hash tokens detected - setting session");
        
        // Mark as processed BEFORE attempting to use the token
        sessionStorage.setItem(processedKey, "1");
        
        try {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionError) {
            if (import.meta.env.DEV) console.error("[AuthCallback] setSession error:", sessionError);
            // Clear the processed marker since we failed
            sessionStorage.removeItem(processedKey);
            if (!cancelled) {
              setError("Reset link expired or invalid. Please request a new one.");
            }
            return;
          }

          if (import.meta.env.DEV) console.log("[AuthCallback] Session set successfully");
          if (!cancelled && !didNavigate.current) {
            didNavigate.current = true;
            window.history.replaceState(null, "", window.location.pathname);
            navigate("/password-reset", { replace: true });
          }
          return;
        } catch (err) {
          if (import.meta.env.DEV) console.error("[AuthCallback] setSession exception:", err);
          // Clear the processed marker since we failed
          sessionStorage.removeItem(processedKey);
          if (!cancelled) {
            setError("Reset link expired or invalid. Please request a new one.");
          }
          return;
        }
      }

      // Handle PKCE recovery link
      if (code) {
        if (import.meta.env.DEV) console.log("[AuthCallback] PKCE code detected - exchanging for session");
        
        // Mark as processed BEFORE attempting to use the code
        sessionStorage.setItem(processedKey, "1");
        
        try {
          await supabase.auth.exchangeCodeForSession(code);
          if (!cancelled && !didNavigate.current) {
            didNavigate.current = true;
            window.history.replaceState(null, "", window.location.pathname);
            navigate("/password-reset", { replace: true });
          }
          return;
        } catch (err) {
          if (import.meta.env.DEV) console.error("[AuthCallback] PKCE exchange error:", err);
          // Clear the processed marker since we failed
          sessionStorage.removeItem(processedKey);
          if (!cancelled) {
            setError("Reset link expired or invalid. Please request a new one.");
          }
          return;
        }
      }

      // Set up auth state listener
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (import.meta.env.DEV) console.log("[AuthCallback] Auth event:", event);

        // Handle password recovery
        if ((event === "PASSWORD_RECOVERY" || isRecoveryContext) && session?.user) {
          // Mark recovery flow
          sessionStorage.setItem("aac_recovery_flow", "1");
          
          if (!didNavigate.current) {
            didNavigate.current = true;
            window.history.replaceState(null, "", window.location.pathname);
            navigate("/password-reset", { replace: true });
          }
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          if (isRecoveryContext) {
            if (!didNavigate.current) {
              didNavigate.current = true;
              window.history.replaceState(null, "", window.location.pathname);
              navigate("/password-reset", { replace: true });
            }
            return;
          }

          window.history.replaceState(null, "", window.location.pathname);

          if (!didNavigate.current) {
            setTimeout(() => {
              routeUser(session.user.id);
            }, 0);
          }
        }
      });

      subscription = data.subscription;

      // Check for existing session
      const checkExistingSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && !didNavigate.current) {
          await routeUser(session.user.id);
        } else if (!session && !hasAuthHash) {
          if (!didNavigate.current) {
            didNavigate.current = true;
            navigate("/auth", { replace: true });
          }
        }
      };

      if (hasAuthHash) {
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
      authDebug("routeUser start", { userId });
      
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if this is a recovery session (type=recovery or sessionStorage flag only)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlParams = new URLSearchParams(window.location.search);
      
      const isRecoverySession =
        hashParams.get("type") === "recovery" ||
        urlParams.get("type") === "recovery" ||
        sessionStorage.getItem("aac_recovery_flow") === "1";
      
      if (isRecoverySession) {
        authDebug("routeUser", { action: "recovery_redirect" });
        didNavigate.current = true;
        navigate('/password-reset', { replace: true });
        return;
      }

      // PRIORITY 1: Check for admin role using has_role RPC - MUST happen before agent checks
      // Do NOT rely on wrappers here; log raw RPC response for production debugging.
      const { data: rpcData, error: rpcError } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      authDebug("routeUser has_role(admin)", {
        email: session?.user?.email ?? null,
        userId,
        rpcData,
        rpcError: rpcError?.message ?? null,
      });

      const isAdmin = rpcData === true;
      if (isAdmin) {
        authDebug("routeUser", { action: "admin_redirect_priority" });
        didNavigate.current = true;
        navigate("/admin/approvals", { replace: true });
        return; // HARD STOP - never continue to agent logic for admins
      }

      // PRIORITY 2: Check agent status for non-admin users
      const agentResult = await getAgentStatus(userId);
      authDebug("routeUser agent status", { userId, status: agentResult.status, error: agentResult.error });
      
      const status = agentResult.status || 'pending';
      
      if (status === 'verified') {
        authDebug("routeUser", { action: "dashboard_redirect" });
        didNavigate.current = true;
        navigate('/agent-dashboard', { replace: true });
      } else {
        // pending, unverified, or no status -> pending verification
        authDebug("routeUser", { action: "pending_redirect", status });
        didNavigate.current = true;
        navigate('/pending-verification', { replace: true });
      }

    } catch (err) {
      console.error("[AuthCallback] Route error:", err);
      authDebug("routeUser error", { error: err instanceof Error ? err.message : "Unknown" });
      didNavigate.current = true;
      navigate('/auth', { replace: true });
    }
  };

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