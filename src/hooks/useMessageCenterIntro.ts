import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  MESSAGE_CENTER_INTRO_SESSION_KEY,
  messageCenterIntroDismissedKey,
} from "@/lib/messageCenterIntro";

export function useMessageCenterIntro(user: User | null) {
  const [visible, setVisible] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(MESSAGE_CENTER_INTRO_SESSION_KEY) === "1",
  );

  useEffect(() => {
    if (!user?.id || sessionDismissed) {
      setVisible(false);
      return;
    }

    const permanentlyDismissed =
      localStorage.getItem(messageCenterIntroDismissedKey(user.id)) === "true";
    setVisible(!permanentlyDismissed);
  }, [user?.id, sessionDismissed]);

  const dismiss = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain && user?.id) {
        localStorage.setItem(messageCenterIntroDismissedKey(user.id), "true");
      }
      sessionStorage.setItem(MESSAGE_CENTER_INTRO_SESSION_KEY, "1");
      setSessionDismissed(true);
      setVisible(false);
    },
    [user?.id],
  );

  const handleLater = useCallback((dontShowAgain: boolean) => dismiss(dontShowAgain), [dismiss]);

  const handleStartMessaging = useCallback(
    (dontShowAgain: boolean) => dismiss(dontShowAgain),
    [dismiss],
  );

  return {
    visible,
    handleLater,
    handleStartMessaging,
  };
}
