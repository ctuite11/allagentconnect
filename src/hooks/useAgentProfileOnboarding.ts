import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AGENT_PROFILE_ONBOARDING_SESSION_KEY } from "@/components/success-hub/AgentProfileOnboardingOverlay";
import { useAgentSettings } from "@/hooks/useAgentSettings";

export function useAgentProfileOnboarding(user: User | null) {
  const userId = user?.id ?? null;
  const {
    settings,
    loading: settingsLoading,
    dismissWelcomeModal,
    checkProfileComplete,
  } = useAgentSettings(user);

  const [visible, setVisible] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(AGENT_PROFILE_ONBOARDING_SESSION_KEY) === "1",
  );
  const evaluationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const evaluationId = ++evaluationRef.current;

    const evaluate = async () => {
      if (!userId || sessionDismissed) {
        if (!cancelled) setVisible(false);
        return;
      }

      if (settingsLoading) {
        return;
      }

      if (settings?.welcome_modal_dismissed) {
        if (!cancelled) setVisible(false);
        return;
      }

      const complete = await checkProfileComplete();
      if (cancelled || evaluationId !== evaluationRef.current) return;

      setVisible(!complete);
    };

    void evaluate();

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    sessionDismissed,
    settingsLoading,
    settings?.welcome_modal_dismissed,
    checkProfileComplete,
  ]);

  const dismissForSession = useCallback(() => {
    sessionStorage.setItem(AGENT_PROFILE_ONBOARDING_SESSION_KEY, "1");
    setSessionDismissed(true);
    setVisible(false);
  }, []);

  const handleLater = useCallback(
    async (dontShowAgain: boolean) => {
      if (dontShowAgain) {
        await dismissWelcomeModal();
      }
      dismissForSession();
    },
    [dismissForSession, dismissWelcomeModal],
  );

  const handleCompleteProfile = useCallback(() => {
    dismissForSession();
  }, [dismissForSession]);

  return {
    visible,
    handleLater,
    handleCompleteProfile,
  };
}
