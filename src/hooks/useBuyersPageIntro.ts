import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BUYERS_PAGE_INTRO_SESSION_KEY,
  buyersPageIntroDismissedKey,
} from "@/lib/buyersPageIntro";

export function useBuyersPageIntro(user: User | null) {
  const [visible, setVisible] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(BUYERS_PAGE_INTRO_SESSION_KEY) === "1",
  );

  useEffect(() => {
    if (!user?.id || sessionDismissed) {
      setVisible(false);
      return;
    }

    const permanentlyDismissed =
      localStorage.getItem(buyersPageIntroDismissedKey(user.id)) === "true";
    setVisible(!permanentlyDismissed);
  }, [user?.id, sessionDismissed]);

  const dismiss = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain && user?.id) {
        localStorage.setItem(buyersPageIntroDismissedKey(user.id), "true");
      }
      sessionStorage.setItem(BUYERS_PAGE_INTRO_SESSION_KEY, "1");
      setSessionDismissed(true);
      setVisible(false);
    },
    [user?.id],
  );

  const handleLater = useCallback((dontShowAgain: boolean) => dismiss(dontShowAgain), [dismiss]);

  const handleAddBuyer = useCallback((dontShowAgain: boolean) => dismiss(dontShowAgain), [dismiss]);

  return {
    visible,
    handleLater,
    handleAddBuyer,
  };
}
