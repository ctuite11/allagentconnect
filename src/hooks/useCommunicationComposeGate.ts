import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkAgentCommunicationPreferencesSet } from "@/lib/checkAgentCommunicationPreferences";

/**
 * Gate targeted Communications Center compose flows behind preference setup.
 * Re-checks eligibility on every `requestCompose` call.
 */
export function useCommunicationComposeGate() {
  const [promptOpen, setPromptOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const requestCompose = useCallback((onAllowed: () => void) => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        return;
      }

      setChecking(true);
      try {
        const hasPrefs = await checkAgentCommunicationPreferencesSet(user.id);
        if (!hasPrefs) {
          setPromptOpen(true);
          return;
        }
        onAllowed();
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const closePrompt = useCallback(() => setPromptOpen(false), []);

  return {
    requestCompose,
    promptOpen,
    checking,
    closePrompt,
  };
}
