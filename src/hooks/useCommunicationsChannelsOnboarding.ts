import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COMMS_CHANNELS_ONBOARDING_SESSION_KEY } from "@/components/communication-center/CommunicationsChannelsOnboardingOverlay";

const permanentDismissKey = (userId: string) => `commsCenterChannelsOnboardingDismissed:${userId}`;

type ChannelPreferences = {
  buyer_need: boolean;
  sales_intel: boolean;
  renter_need: boolean;
  general_discussion: boolean;
};

function anyChannelActive(prefs: ChannelPreferences): boolean {
  return Object.values(prefs).some(Boolean);
}

export function useCommunicationsChannelsOnboarding(
  userId: string | null | undefined,
  preferencesVersion = 0,
) {
  const [visible, setVisible] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(COMMS_CHANNELS_ONBOARDING_SESSION_KEY) === "1",
  );
  const evaluationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const evaluationId = ++evaluationRef.current;

    const evaluate = async () => {
      if (!userId || sessionDismissed) {
        if (!cancelled) setVisible(false);
        return;
      }

      if (localStorage.getItem(permanentDismissKey(userId)) === "true") {
        if (!cancelled) setVisible(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("notification_preferences")
          .select("buyer_need, sales_intel, renter_need, general_discussion")
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled || evaluationId !== evaluationRef.current) return;

        if (error && error.code !== "PGRST116") {
          console.error("[useCommunicationsChannelsOnboarding] fetch error:", error);
          setVisible(false);
          return;
        }

        const prefs: ChannelPreferences = {
          buyer_need: (data as ChannelPreferences | null)?.buyer_need ?? false,
          sales_intel: (data as ChannelPreferences | null)?.sales_intel ?? false,
          renter_need: (data as ChannelPreferences | null)?.renter_need ?? false,
          general_discussion: (data as ChannelPreferences | null)?.general_discussion ?? false,
        };

        setVisible(!anyChannelActive(prefs));
      } catch (error) {
        console.error("[useCommunicationsChannelsOnboarding] evaluate failed:", error);
        if (!cancelled) setVisible(false);
      }
    };

    void evaluate();

    return () => {
      cancelled = true;
    };
  }, [userId, sessionDismissed, preferencesVersion]);

  const dismissForSession = useCallback(() => {
    sessionStorage.setItem(COMMS_CHANNELS_ONBOARDING_SESSION_KEY, "1");
    setSessionDismissed(true);
    setVisible(false);
  }, []);

  const dismissPermanently = useCallback(() => {
    if (userId) {
      localStorage.setItem(permanentDismissKey(userId), "true");
    }
    dismissForSession();
  }, [userId, dismissForSession]);

  const handleLater = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain) {
        dismissPermanently();
      } else {
        dismissForSession();
      }
    },
    [dismissForSession, dismissPermanently],
  );

  const handleChooseChannels = useCallback(
    (dontShowAgain?: boolean) => {
      if (dontShowAgain) {
        dismissPermanently();
      } else {
        dismissForSession();
      }
    },
    [dismissForSession, dismissPermanently],
  );

  return {
    visible,
    handleLater,
    handleChooseChannels,
  };
}
