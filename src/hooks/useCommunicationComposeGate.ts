import { useCallback, useState } from "react";
import { useAuthRole } from "@/hooks/useAuthRole";
import { checkAgentCommunicationPreferencesSet } from "@/lib/checkAgentCommunicationPreferences";

/**
 * Gate targeted Communications Center compose flows behind preference setup.
 * Re-checks eligibility on every `requestCompose` call.
 */
export function useCommunicationComposeGate() {
  const { user } = useAuthRole();
  const [promptOpen, setPromptOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const requestCompose = useCallback(
    (onAllowed: () => void) => {
      void (async () => {
        const userId = user?.id;
        if (!userId) {
          onAllowed();
          return;
        }

        setChecking(true);
        try {
          const hasPrefs = await checkAgentCommunicationPreferencesSet(userId);
          if (!hasPrefs) {
            setPromptOpen(true);
            return;
          }
          onAllowed();
        } finally {
          setChecking(false);
        }
      })();
    },
    [user?.id],
  );

  const closePrompt = useCallback(() => setPromptOpen(false), []);

  return {
    requestCompose,
    promptOpen,
    checking,
    closePrompt,
  };
}
