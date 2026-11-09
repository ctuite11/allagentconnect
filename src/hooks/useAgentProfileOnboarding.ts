import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AGENT_PROFILE_ONBOARDING_SESSION_KEY, type SetupChecklistCompletion } from "@/components/success-hub/AgentProfileOnboardingOverlay";
import { useAgentSettings } from "@/hooks/useAgentSettings";
import { consumeSetupChecklistWelcome } from "@/lib/setupChecklistWelcomeHandoff";
import { supabase } from "@/integrations/supabase/client";

export type { SetupChecklistCompletion };

const EMPTY_COMPLETION: SetupChecklistCompletion = {
  communications: false,
  profile: false,
  hotSheet: false,
};

async function hasAnyHotSheet(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("hot_sheets")
    .select("id")
    .eq("user_id", userId)
    .eq("is_draft", false)
    .limit(1);

  if (error) {
    console.error("Error checking hot sheets for setup checklist:", error);
    return false;
  }

  return Boolean(data?.length);
}

export function useAgentProfileOnboarding(user: User | null) {
  const userId = user?.id ?? null;
  const {
    settings,
    loading: settingsLoading,
    dismissWelcomeModal,
    checkProfileComplete,
  } = useAgentSettings(user);

  const [visible, setVisible] = useState(false);
  const [completion, setCompletion] = useState<SetupChecklistCompletion>(EMPTY_COMPLETION);
  /** One-time Welcome copy from post-activation handoff (not checklist progress). */
  const [isPostActivationWelcome, setIsPostActivationWelcome] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(AGENT_PROFILE_ONBOARDING_SESSION_KEY) === "1",
  );
  const evaluationRef = useRef(0);
  // Latest helpers via refs: these functions are recreated on every render, so
  // listing them as effect inputs re-ran the check (2 queries) on every render.
  const checkProfileCompleteRef = useRef(checkProfileComplete);
  checkProfileCompleteRef.current = checkProfileComplete;
  const dismissWelcomeModalRef = useRef(dismissWelcomeModal);
  dismissWelcomeModalRef.current = dismissWelcomeModal;
  const welcomeHandoffConsumedRef = useRef(false);

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

      const [profileDone, hotSheetDone] = await Promise.all([
        checkProfileCompleteRef.current(),
        hasAnyHotSheet(userId),
      ]);
      if (cancelled || evaluationId !== evaluationRef.current) return;

      const next: SetupChecklistCompletion = {
        communications: settings?.preferences_set === true,
        profile: profileDone,
        hotSheet: hotSheetDone,
      };
      setCompletion(next);

      const allDone = next.communications && next.profile && next.hotSheet;
      if (allDone) {
        // Fully set up — permanently suppress so the checklist does not keep
        // reappearing for members who already finished every step.
        await dismissWelcomeModalRef.current();
        if (cancelled || evaluationId !== evaluationRef.current) return;
        setVisible(false);
        return;
      }

      // First time this hook instance shows the checklist: consume the
      // one-time post-activation Welcome handoff for this account only.
      if (!welcomeHandoffConsumedRef.current) {
        welcomeHandoffConsumedRef.current = true;
        setIsPostActivationWelcome(
          consumeSetupChecklistWelcome(userId, user?.email ?? null),
        );
      }

      setVisible(true);
    };

    void evaluate();

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    user?.email,
    sessionDismissed,
    settingsLoading,
    settings?.welcome_modal_dismissed,
    settings?.preferences_set,
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
    completion,
    isPostActivationWelcome,
    handleLater,
    handleStepNavigate,
  };
}
