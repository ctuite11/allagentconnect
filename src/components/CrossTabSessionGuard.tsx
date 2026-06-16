import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Cross-tab session-change guard rail.
 *
 * Supabase auth uses localStorage, which is shared across tabs in the same
 * browser profile. When another tab signs in/registers as a different user,
 * this tab silently adopts that session and can land on /access-error.
 *
 * This component watches onAuthStateChange for an in-place user-id swap
 * (previous id non-null → new id non-null, and different), and shows a
 * single non-blocking toast with Reload / Sign out actions.
 *
 * No auth persistence, role logic, or routing is changed.
 */
export function CrossTabSessionGuard() {
  const lastUserIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const activeToastRef = useRef<string | number | null>(null);
  const announcedSwitchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Seed from current session so the very first auth event doesn't fire a swap.
    supabase.auth.getSession().then(({ data }) => {
      lastUserIdRef.current = data.session?.user?.id ?? null;
      initializedRef.current = true;
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const newId = session?.user?.id ?? null;

      if (!initializedRef.current) {
        lastUserIdRef.current = newId;
        initializedRef.current = true;
        return;
      }

      const prevId = lastUserIdRef.current;

      // Sign-out events: reset state so a later sign-in isn't flagged as a swap.
      if (newId === null) {
        lastUserIdRef.current = null;
        announcedSwitchKeyRef.current = null;
        return;
      }

      // Only flag true in-place account switches (both sides non-null and different).
      if (prevId && newId !== prevId) {
        const switchKey = `${prevId}→${newId}`;

        // Dedupe: don't stack the same announcement across repeated auth events.
        if (announcedSwitchKeyRef.current !== switchKey) {
          announcedSwitchKeyRef.current = switchKey;

          // Dismiss any prior guard toast so only one is visible.
          if (activeToastRef.current !== null) {
            toast.dismiss(activeToastRef.current);
          }

          activeToastRef.current = toast(
            "You're now signed in as a different account in another tab.",
            {
              description: "Reload to continue, or sign out and sign back in.",
              duration: Infinity,
              action: {
                label: "Reload",
                onClick: () => window.location.reload(),
              },
              cancel: {
                label: "Sign out",
                onClick: async () => {
                  try {
                    await supabase.auth.signOut();
                  } finally {
                    window.location.assign("/auth");
                  }
                },
              },
              onDismiss: () => {
                activeToastRef.current = null;
              },
              onAutoClose: () => {
                activeToastRef.current = null;
              },
            },
          );
        }
      }

      lastUserIdRef.current = newId;
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}

export default CrossTabSessionGuard;