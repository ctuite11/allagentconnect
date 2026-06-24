import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AGENT_PROFILE_ONBOARDING_SESSION_KEY } from "@/components/success-hub/AgentProfileOnboardingOverlay";
import { useAgentSettings } from "@/hooks/useAgentSettings";

export function useAgentProfileOnboarding(user: User | null, isVerifiedAgent: boolean) {
  const {
    settings,
    loading: settingsLoading,
    dismissWelcomeModal,
    checkProfileComplete,
  } = useAgentSettings(user);

  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(AGENT_PROFILE_ONBOARDING_SESSION_KEY) === "1",
  );
  const [visible, setVisible] = useState(false);

  const evaluateProfile = useCallback(async () => {
    if (!user || !isVerifiedAgent) {
      setProfileComplete(null);
      setVisible(false);
      return;
    }

    setCheckingProfile(true);
    try {
      const complete = await checkProfileComplete();
      setProfileComplete(complete);
    } finally {
      setCheckingProfile(false);
    }
  }, [user, isVerifiedAgent, checkProfileComplete]);

  useEffect(() => {
    void evaluateProfile();
  }, [evaluateProfile]);

  useEffect(() => {
    if (!user || !isVerifiedAgent || settingsLoading || checkingProfile) {
      setVisible(false);
      return;
    }

    if (profileComplete === null) return;

    const permanentlyDismissed = settings?.welcome_modal_dismissed === true;
    const shouldShow =
      !profileComplete && !permanentlyDismissed && !sessionDismissed;

    setVisible(shouldShow);
  }, [
    user,
    isVerifiedAgent,
    settingsLoading,
    checkingProfile,
    profileComplete,
    settings?.welcome_modal_dismissed,
    sessionDismissed,
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
    refetchProfileStatus: evaluateProfile,
  };
}
