import { useCallback, useEffect, useRef, useState } from "react";
import { loadTurnstileScript, TURNSTILE_SITE_KEY } from "@/lib/turnstile";

export function useTurnstile(action?: string, enabled = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const tokenIssuedAtRef = useRef<number>(0);
  const consumedTokensRef = useRef<Set<string>>(new Set());
  const pendingTokenRef = useRef<((value: string | null) => void) | null>(null);

  // Cloudflare tokens are valid for 300s. Refresh well before that so a slow
  // form fill can never submit an expired token.
  const TOKEN_MAX_AGE_MS = 100_000;
  const TOKEN_WAIT_MS = 15_000;

  const reset = useCallback(() => {
    setToken(null);
    setError(null);
    tokenIssuedAtRef.current = 0;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  const onVerify = useCallback((value: string) => {
    setToken(value);
    setError(null);
    tokenIssuedAtRef.current = Date.now();
    const resolve = pendingTokenRef.current;
    pendingTokenRef.current = null;
    resolve?.(value);
  }, []);

  const onExpire = useCallback(() => {
    setToken(null);
    tokenIssuedAtRef.current = 0;
    setError("Verification expired. Please complete the check again.");
  }, []);

  const onError = useCallback(() => {
    setToken(null);
    tokenIssuedAtRef.current = 0;
    const resolve = pendingTokenRef.current;
    pendingTokenRef.current = null;
    resolve?.(null);
    setError("Verification failed. Please try again.");
  }, []);

  const requireToken = useCallback((): string | null => {
    if (!token) {
      setError("Please complete the verification check before continuing.");
      return null;
    }
    return token;
  }, [token]);

  /**
   * Returns a token that is guaranteed to be unused and recently issued.
   * If the current token is stale, missing, or was already sent to the server,
   * the widget is reset and we wait for a fresh solve before resolving.
   */
  const getFreshToken = useCallback(async (): Promise<string | null> => {
    const current = token;
    const isFresh =
      Boolean(current) &&
      !consumedTokensRef.current.has(current as string) &&
      Date.now() - tokenIssuedAtRef.current < TOKEN_MAX_AGE_MS;

    if (isFresh) {
      consumedTokensRef.current.add(current as string);
      return current;
    }

    if (!widgetIdRef.current || !window.turnstile) {
      setError("Please complete the verification check before continuing.");
      return null;
    }

    const waiter = new Promise<string | null>((resolve) => {
      pendingTokenRef.current = resolve;
      window.setTimeout(() => {
        if (pendingTokenRef.current === resolve) {
          pendingTokenRef.current = null;
          resolve(null);
        }
      }, TOKEN_WAIT_MS);
    });

    setToken(null);
    tokenIssuedAtRef.current = 0;
    window.turnstile.reset(widgetIdRef.current);

    const fresh = await waiter;
    if (!fresh) {
      setError("Verification check timed out. Please complete it and try again.");
      return null;
    }
    consumedTokensRef.current.add(fresh);
    return fresh;
  }, [token]);

  useEffect(() => {
    if (!enabled) {
      setToken(null);
      setError(null);
      setReady(false);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const waitForContainer = async (): Promise<HTMLDivElement | null> => {
      // The form can be hidden (e.g. while the auth session check runs), so the
      // container may not exist yet when the script finishes loading. Poll for it.
      for (let i = 0; i < 120; i += 1) {
        if (cancelled) return null;
        if (containerRef.current) return containerRef.current;
        await new Promise((r) => setTimeout(r, 250));
      }
      return null;
    };

    loadTurnstileScript()
      .then(() => waitForContainer())
      .then((container) => {
        if (cancelled || !container || !window.turnstile) return;

        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: onVerify,
          "expired-callback": onExpire,
          "error-callback": onError,
          theme: "light",
          size: "flexible",
          action,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load verification. Please refresh and try again.");
        }
      });

    return () => {
      cancelled = true;
      pendingTokenRef.current = null;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, enabled, onError, onExpire, onVerify]);

  return {
    containerRef,
    token,
    error,
    ready,
    isVerified: Boolean(token),
    requireToken,
    getFreshToken,
    reset,
    clearError: () => setError(null),
  };
}
