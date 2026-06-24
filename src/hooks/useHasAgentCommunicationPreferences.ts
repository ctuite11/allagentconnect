import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { checkAgentCommunicationPreferencesSet } from "@/lib/checkAgentCommunicationPreferences";

/** `null` while loading; `true`/`false` once resolved. */
export function useHasAgentCommunicationPreferences(user: User | null) {
  const [hasPreferences, setHasPreferences] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setHasPreferences(null);
      return;
    }

    let cancelled = false;
    void checkAgentCommunicationPreferencesSet(user.id).then((result) => {
      if (!cancelled) setHasPreferences(result);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return {
    hasPreferences,
    loading: Boolean(user?.id) && hasPreferences === null,
  };
}
