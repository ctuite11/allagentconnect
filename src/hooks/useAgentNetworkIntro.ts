import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AGENT_NETWORK_INTRO_SESSION_KEY,
  agentNetworkIntroDismissedKey,
} from "@/lib/agentNetworkIntro";

type UseAgentNetworkIntroOptions = {
  enabled?: boolean;
};

export function useAgentNetworkIntro(
  user: User | null,
  { enabled = true }: UseAgentNetworkIntroOptions = {},
) {
  const [visible, setVisible] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(AGENT_NETWORK_INTRO_SESSION_KEY) === "1",
  );

  useEffect(() => {
    if (!enabled || !user?.id || sessionDismissed) {
      setVisible(false);
      return;
    }

    const permanentlyDismissed =
      localStorage.getItem(agentNetworkIntroDismissedKey(user.id)) === "true";
    setVisible(!permanentlyDismissed);
  }, [enabled, user?.id, sessionDismissed]);

  const dismiss = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain && user?.id) {
        localStorage.setItem(agentNetworkIntroDismissedKey(user.id), "true");
      }
      sessionStorage.setItem(AGENT_NETWORK_INTRO_SESSION_KEY, "1");
      setSessionDismissed(true);
      setVisible(false);
    },
    [user?.id],
  );

  const handleLater = useCallback((dontShowAgain: boolean) => dismiss(dontShowAgain), [dismiss]);

  const handleSeeProfile = useCallback(
    (dontShowAgain: boolean) => dismiss(dontShowAgain),
    [dismiss],
  );

  const handleUpdateProfile = useCallback(
    (dontShowAgain: boolean) => dismiss(dontShowAgain),
    [dismiss],
  );

  return {
    visible,
    handleLater,
    handleSeeProfile,
    handleUpdateProfile,
  };
}
