import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ADD_LISTING_STATUS_INTRO_SESSION_KEY,
  addListingStatusIntroDismissedKey,
} from "@/lib/addListingStatusHelp";

export function useAddListingStatusIntro(user: User | null) {
  const [introChecked, setIntroChecked] = useState(false);
  const [visible, setVisible] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(ADD_LISTING_STATUS_INTRO_SESSION_KEY) === "1",
  );

  useEffect(() => {
    if (!user?.id) {
      setVisible(false);
      setIntroChecked(true);
      return;
    }

    if (sessionDismissed) {
      setVisible(false);
      setIntroChecked(true);
      return;
    }

    const permanentlyDismissed =
      localStorage.getItem(addListingStatusIntroDismissedKey(user.id)) === "true";
    setVisible(!permanentlyDismissed);
    setIntroChecked(true);
  }, [user?.id, sessionDismissed]);

  const dismiss = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain && user?.id) {
        localStorage.setItem(addListingStatusIntroDismissedKey(user.id), "true");
      }
      sessionStorage.setItem(ADD_LISTING_STATUS_INTRO_SESSION_KEY, "1");
      setSessionDismissed(true);
      setVisible(false);
    },
    [user?.id],
  );

  const handleGotIt = useCallback((dontShowAgain: boolean) => dismiss(dontShowAgain), [dismiss]);

  return {
    introChecked,
    introVisible: visible,
    handleGotIt,
  };
};
