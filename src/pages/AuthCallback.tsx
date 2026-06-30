import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { Button } from "@/components/ui/button";
import { authDebug, getAuthRouteDecisionDiagnostics } from "@/lib/authDebug";
import { resolveUserRole, getRouteForRole } from "@/lib/resolveUserRole";
import { clearGuestListing, resolvePostAuthRedirectWithMeta } from "@/lib/sharedListingGuest";
import { clearRecoveryState } from "@/lib/authRecovery";

const rememberAgentSetupHandoff = (session: { user?: { id?: string; email?: string | null } | null } | null | undefined) => {
  if (typeof window === "undefined") return;
  const user = session?.user;
  if (!user) return;
  sessionStorage.setItem("aac_agent_setup_handoff", "1");
  if (user.id) sessionStorage.setItem("aac_agent_setup_user_id", user.id);
  if (user.email) sessionStorage.setItem("aac_agent_setup_email", user.email);
};

function withCallbackTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([Promise.resolve(p), timeout]).finally(() => {
    if (t) clearTimeout(t);
  });
}

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const didNavigate = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // Parse recovery context from URL (pure computation — no side effects)
  // ═══════════════════════════════════════════════════════════════════════════
  const recoveryInfo = useMemo(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const typeFromHash = hashParams.get("type");
    const typeFromQuery = searchParams.get("type");
    const isRecovery = typeFromHash === "recovery" || typeFromQuery === "recovery";
    const setupFromHash = hashParams.get("setup");
    const setupFromQuery = searchParams.get("setup");
    const isSetup = setupFromHash === "1" || setupFromQuery === "1";
    return { isRecovery, isSetup };
  }, [searchParams]);

  const isRecoveryContext = recoveryInfo.isRecovery;

  // Set sessionStorage markers in useLayoutEffect (before paint, but not in render)
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!recoveryInfo.isRecovery && !recoveryInfo.isSetup) return;

    sessionStorage.setItem("aac_recovery_flow", "1");
    if (recoveryInfo.isSetup) {
      sessionStorage.setItem("aac_password_setup_flow", "1");
    } else {
      sessionStorage.removeItem("aac_password_setup_flow");
    }

    if (import.meta.env.DEV) {
      console.log(
        "[AuthCallback] Recovery context captured, flow:",
        recoveryInfo.isSetup ? "setup" : "reset",
      );
    }
  }, [recoveryInfo.isRecovery, recoveryInfo.isSetup]);
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const typeFromHash = hashParams.get("type");
    const typeFromQuery = searchParams.get("type");
    const code = searchParams.get("code");

    // Hash-based tokens (implicit flow)
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    // Generate a stable key to prevent double-processing
    const tokenKey =
      accessToken?.slice(0, 16) ||
      code?.slice(0, 16) ||
      "unknown";

    const hasStableTokenKey = tokenKey !== "unknown";
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
        tokenKey: hasStableTokenKey ? tokenKey.substring(0, 8) + "..." : "unknown",
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

    // If we landed here without a usable token/code, fail fast with a clear message.
    // This commonly happens when the one-time link was already consumed.
    if (isRecoveryContext && !accessToken && !refreshToken && !code) {
      setError("Reset link expired or invalid. Please request a new one.");
      return;
    }

    // CRITICAL: Check if this link was already processed (email clients can double-open)
    // Only enforce this when we actually have a stable token key.
    if (hasStableTokenKey && sessionStorage.getItem(processedKey)) {
      console.log("[AuthCallback] Link already processed, showing error");
      setError("This link was already used. Please request a new password reset link.");
      return;
    }

    const hasAuthHash = window.location.hash.includes("access_token");

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let subscription: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    const init = async () => {
      // Handle hash-based recovery tokens (implicit flow)
      if (accessToken && refreshToken) {
        console.info("[AuthCallback] diag", { branch: "hash_setSession_start", setup: recoveryInfo.isSetup });
        try {
          const { data: setSessionData, error: sessionError } = await withCallbackTimeout(
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
            6000,
            "setSession",
          );
          
          if (sessionError) {
            console.warn("[AuthCallback] diag", { branch: "hash_setSession_error" });
            sessionStorage.removeItem(processedKey);
            if (!cancelled) {
              setError("Reset link expired or invalid. Please request a new one.");
            }
            return;
          }

          if (import.meta.env.DEV) console.log("[AuthCallback] Session set successfully");
          // Mark as processed AFTER successfully establishing session
          if (hasStableTokenKey) sessionStorage.setItem(processedKey, "1");

          if (!cancelled && !didNavigate.current) {
            const isSetupContext =
              isRecoveryContext ||
              sessionStorage.getItem("aac_recovery_flow") === "1" ||
              sessionStorage.getItem("aac_password_setup_flow") === "1";
            didNavigate.current = true;
            window.history.replaceState(null, "", window.location.pathname);
            if (isSetupContext) {
              const isAgentSetup =
                recoveryInfo.isSetup ||
                sessionStorage.getItem("aac_password_setup_flow") === "1";
              if (isAgentSetup) rememberAgentSetupHandoff(setSessionData?.session);
              navigate(isAgentSetup ? "/agent-setup" : "/password-reset", { replace: true });
            } else {
              const { data: { session: freshSession } } = await supabase.auth.getSession();
              if (freshSession?.user) {
                didNavigate.current = false;
                await routeUser(freshSession.user.id);
              } else {
                navigate("/auth", { replace: true });
              }
            }
          }
          return;
        } catch (err) {
          console.warn("[AuthCallback] diag", { branch: "hash_setSession_timeout_or_exception" });
          sessionStorage.removeItem(processedKey);
          if (!cancelled && !didNavigate.current) {
            const isSetupCtx =
              recoveryInfo.isSetup ||
              sessionStorage.getItem("aac_password_setup_flow") === "1";
            if (isSetupCtx) {
              didNavigate.current = true;
              navigate("/agent-setup", { replace: true });
            } else {
              setError("Reset link expired or invalid. Please request a new one.");
            }
          }
          return;
        }
      }

      // Handle PKCE recovery link
      if (code) {
        console.info("[AuthCallback] diag", { branch: "pkce_exchange_start", setup: recoveryInfo.isSetup });
        try {
          await withCallbackTimeout(
            supabase.auth.exchangeCodeForSession(code),
            6000,
            "exchangeCodeForSession",
          );
          // Mark as processed AFTER successfully exchanging code
          if (hasStableTokenKey) sessionStorage.setItem(processedKey, "1");

          if (!cancelled && !didNavigate.current) {
            const isSetupContext =
              isRecoveryContext ||
              sessionStorage.getItem("aac_recovery_flow") === "1" ||
              sessionStorage.getItem("aac_password_setup_flow") === "1";
            didNavigate.current = true;
            window.history.replaceState(null, "", window.location.pathname);
            if (isSetupContext) {
              const isAgentSetup =
                recoveryInfo.isSetup ||
                sessionStorage.getItem("aac_password_setup_flow") === "1";
              if (isAgentSetup) {
                try {
                  const { data: { session: setupSession } } = await withCallbackTimeout(
                    supabase.auth.getSession(),
                    3000,
                    "getSession(setup handoff)",
                  );
                  rememberAgentSetupHandoff(setupSession);
                } catch {
                  console.warn("[AuthCallback] diag", { branch: "pkce_handoff_getSession_timeout" });
                }
              }
              navigate(isAgentSetup ? "/agent-setup" : "/password-reset", { replace: true });
            } else {
              const { data: { session: freshSession } } = await supabase.auth.getSession();
              if (freshSession?.user) {
                didNavigate.current = false;
                await routeUser(freshSession.user.id);
              } else {
                navigate("/auth", { replace: true });
              }
            }
          }
          return;
        } catch (err) {
          console.warn("[AuthCallback] diag", { branch: "pkce_exchange_timeout_or_error" });
          sessionStorage.removeItem(processedKey);
          if (!cancelled && !didNavigate.current) {
            const isSetupCtx =
              recoveryInfo.isSetup ||
              sessionStorage.getItem("aac_password_setup_flow") === "1";
            if (isSetupCtx) {
              didNavigate.current = true;
              navigate("/agent-setup", { replace: true });
            } else {
              setError("Reset link expired or invalid. Please request a new one.");
            }
          }
          return;
        }
      }

      // Set up auth state listener
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (import.meta.env.DEV) console.log("[AuthCallback] Auth event:", event);

        // After a password update, scrub markers so no later event can
        // route the user back into a password form.
        if (event === "USER_UPDATED") {
          clearRecoveryState();
          return;
        }

        // Handle password recovery
        if ((event === "PASSWORD_RECOVERY" || isRecoveryContext) && session?.user) {
          // Mark recovery flow
          sessionStorage.setItem("aac_recovery_flow", "1");
          
          if (!didNavigate.current) {
            didNavigate.current = true;
            window.history.replaceState(null, "", window.location.pathname);
            const isAgentSetup = sessionStorage.getItem("aac_password_setup_flow") === "1";
            if (isAgentSetup) rememberAgentSetupHandoff(session);
            navigate(isAgentSetup ? "/agent-setup" : "/password-reset", { replace: true });
          }
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          // Only treat this as a recovery/setup landing when the CURRENT
          // URL carries recovery context, or an active setup flag is
          // present. A stale `aac_recovery_flow` from an earlier flow
          // must not hijack a normal sign-in.
          const hasActiveSetup =
            sessionStorage.getItem("aac_password_setup_flow") === "1";
          if (isRecoveryContext || hasActiveSetup) {
            if (!didNavigate.current) {
              didNavigate.current = true;
              window.history.replaceState(null, "", window.location.pathname);
              const isAgentSetup = hasActiveSetup;
              if (isAgentSetup) rememberAgentSetupHandoff(session);
              navigate(isAgentSetup ? "/agent-setup" : "/password-reset", { replace: true });
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
        // Recovery/setup priority: only act on markers when the CURRENT
        // navigation carries recovery context, or a setup flag is active.
        // A stale `aac_recovery_flow` from an earlier flow must not
        // override a normal authenticated session.
        const hasActiveSetup =
          sessionStorage.getItem("aac_password_setup_flow") === "1";
        if ((isRecoveryContext || hasActiveSetup) && !didNavigate.current) {
          if (import.meta.env.DEV) {
            console.log("[AuthCallback] Active recovery/setup context — routing to setup form");
          }
          didNavigate.current = true;
          window.history.replaceState(null, "", window.location.pathname);
          const isAgentSetup = hasActiveSetup;
          if (isAgentSetup) {
            const { data: { session } } = await supabase.auth.getSession();
            rememberAgentSetupHandoff(session);
          }
          navigate(isAgentSetup ? "/agent-setup" : "/password-reset", { replace: true });
          return;
        }

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

  const resolveRoleWithRetries = async (verifiedUserId: string) => {
    const maxAttempts = 3;
    const retryDelayMs = 500;
    let resolved = await resolveUserRole(verifiedUserId);

    if (import.meta.env.DEV) {
      console.info("[POST_LOGIN] resolveUserRole #1", {
        userId: verifiedUserId,
        role: resolved.role,
        is_verified_agent: resolved.is_verified_agent,
      });
    }

    for (let attempt = 1; attempt < maxAttempts && resolved.role === "unknown"; attempt++) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
      resolved = await resolveUserRole(verifiedUserId);
      if (import.meta.env.DEV) {
        console.info(`[POST_LOGIN] resolveUserRole #${attempt + 1} (retry)`, {
          userId: verifiedUserId,
          role: resolved.role,
          is_verified_agent: resolved.is_verified_agent,
        });
      }
    }

    return resolved;
  };

  const routeUser = async (userId: string) => {
    if (didNavigate.current) return;

    try {
      authDebug("routeUser start", { userId });
      
      const { data: { session } } = await supabase.auth.getSession();
      
      // Recovery short-circuit: only when CURRENT URL carries recovery
      // context, or an active setup flag is present. A stale recovery
      // marker alone must never re-route a normal sign-in.
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlParams = new URLSearchParams(window.location.search);
      const hasActiveSetup =
        sessionStorage.getItem("aac_password_setup_flow") === "1";
      const isRecoverySession =
        hashParams.get("type") === "recovery" ||
        urlParams.get("type") === "recovery" ||
        hasActiveSetup;
      
      if (isRecoverySession) {
        authDebug("routeUser", { action: "recovery_redirect" });
        didNavigate.current = true;
        const isAgentSetup = hasActiveSetup;
        if (isAgentSetup) rememberAgentSetupHandoff(session);
        navigate(isAgentSetup ? "/agent-setup" : "/password-reset", { replace: true });
        return;
      }

      // Re-validate session against the auth server so we route on the
      // server-confirmed user id, not a stale localStorage cache.
      const { data: userData } = await supabase.auth.getUser();
      const verifiedUserId = userData?.user?.id ?? userId;
      const verifiedEmail = userData?.user?.email ?? session?.user?.email ?? null;
      const intendedRole = userData?.user?.user_metadata?.intended_role;

      let resolved = await resolveRoleWithRetries(verifiedUserId);

      if (resolved.role === "unknown" && intendedRole === "agent") {
        authDebug("routeUser self-heal assign_self_role", { userId: verifiedUserId });
        const { error: assignError } = await supabase.rpc("assign_self_role", { _role: "agent" });
        if (assignError) {
          console.error("[AuthCallback] self-heal assign_self_role failed:", assignError);
        } else {
          await new Promise((r) => setTimeout(r, 500));
          resolved = await resolveRoleWithRetries(verifiedUserId);
        }
      }

      const returnToMeta = resolvePostAuthRedirectWithMeta(searchParams);
      const target = returnToMeta.value ?? getRouteForRole(resolved);
      const diagnostics = await getAuthRouteDecisionDiagnostics(verifiedUserId);
      // Visitor has now signed in — they're no longer a shared-listing guest.
      clearGuestListing();

      authDebug("routeUser resolved", {
        email: verifiedEmail,
        userId: verifiedUserId,
        role: resolved.role,
        is_verified_agent: resolved.is_verified_agent,
        target,
      });
      console.info("[AUTH_ROUTE] AuthCallback redirect", {
        email: verifiedEmail,
        userId: verifiedUserId,
        role: resolved.role,
        is_verified_agent: resolved.is_verified_agent,
        target,
      });
      console.info("[AUTH_ROUTE_DECISION] AuthCallback.routeUser", {
        userId: verifiedUserId,
        email: verifiedEmail,
        role: resolved.role,
        resolved_role: resolved.role,
        admin_role_present: diagnostics.admin_role_present,
        agent_role_present: diagnostics.agent_role_present,
        agent_status: diagnostics.agent_status,
        is_verified_agent: resolved.is_verified_agent,
        returnTo_source: returnToMeta.source,
        returnTo_value: returnToMeta.value,
        rejected_returnTo_source: returnToMeta.rejectedSource,
        rejected_returnTo_value: returnToMeta.rejectedValue,
        target,
        final_redirect_target: target,
      });

      didNavigate.current = true;
      navigate(target, { replace: true });

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

  return <AacMonogramLoader variant="fullscreen" message="Setting up your account…" />;
};

export default AuthCallback;