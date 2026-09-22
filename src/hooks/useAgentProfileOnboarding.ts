import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AGENT_PROFILE_ONBOARDING_SESSION_KEY } from "@/components/success-hub/AgentProfileOnboardingOverlay";
import { useAgentSettings } from "@/hooks/useAgentSettings";

export function useAgentProfileOnboarding(user: User | null) {
  const userId = user?.id ?? null;
  const {
    settings,
    loading: settingsLoading,
    dismissWelcomeModal,
  } = useAgentSettings(user);

  const [visible, setVisible] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(AGENT_PROFILE_ONBOARDING_SESSION_KEY) === "1",
  );

  useEffect(() => {
    if (!userId || sessionDismissed) {
      setVisible(false);
      return;
    }

    if (settingsLoading) {
      return;
    }

    setVisible(!settings?.welcome_modal_dismissed);
  }, [
    userId,
    sessionDismissed,
    settingsLoading,
    settings?.welcome_modal_dismissed,
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

  const handleStepNavigate = useCallback(
    async (dontShowAgain?: boolean) => {
      if (dontShowAgain) {
        await dismissWelcomeModal();
      }
      dismissForSession();
    },
    [dismissForSession, dismissWelcomeModal],
  );

  return {
    visible,
    handleLater,
    handleStepNavigate,
  };
}
