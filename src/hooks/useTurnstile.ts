import { useCallback, useEffect, useRef, useState } from "react";
import { loadTurnstileScript, TURNSTILE_SITE_KEY } from "@/lib/turnstile";

export function useTurnstile(action?: string, enabled = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const reset = useCallback(() => {
    setToken(null);
    setError(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  const onVerify = useCallback((value: string) => {
    setToken(value);
    setError(null);
  }, []);

  const onExpire = useCallback(() => {
    setToken(null);
    setError("Verification expired. Please complete the check again.");
  }, []);

  const onError = useCallback(() => {
    setToken(null);
    setError("Verification failed. Please try again.");
  }, []);

  const requireToken = useCallback((): string | null => {
    if (!token) {
      setError("Please complete the verification check before continuing.");
      return null;
    }
    return token;
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
    reset,
    clearError: () => setError(null),
  };
}
