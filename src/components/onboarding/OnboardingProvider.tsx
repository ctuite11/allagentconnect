import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { useAgentSettings } from "@/hooks/useAgentSettings";
import { WelcomeModal } from "./WelcomeModal";
import { SetupBar } from "./SetupBar";
import { Coachmark, coachmarkContent } from "./Coachmark";
import { toast } from "sonner";

interface OnboardingContextValue {
  isOnboardingComplete: boolean;
  profileComplete: boolean;
  preferencesSet: boolean;
  notificationsSet: boolean;
  showSetupBar: boolean;
  markProfileComplete: () => void;
  markPreferencesComplete: () => void;
  markNotificationsComplete: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
};

interface OnboardingProviderProps {
  user: User | null;
  role: "agent" | "buyer" | null;
  children: ReactNode;
}

export const OnboardingProvider = ({ user, role, children }: OnboardingProviderProps) => {
  const navigate = useNavigate();
  const { settings, loading, updateSettings, checkProfileComplete } = useAgentSettings(user);
  
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [activeCoachmark, setActiveCoachmark] = useState<"profile" | "preferences" | "notifications" | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [coachmarkDismissed, setCoachmarkDismissed] = useState<Record<string, boolean>>({});

  // Check if this is a new agent who hasn't seen the welcome modal
  useEffect(() => {
    if (loading || !user || role !== "agent") return;
    
    if (settings && !settings.welcome_modal_dismissed && !settings.onboarding_started) {
      setShowWelcomeModal(true);
    }
  }, [loading, user, role, settings]);

  // Check profile completeness
  useEffect(() => {
    if (!user || role !== "agent") return;
    
    checkProfileComplete().then(setProfileComplete);
  }, [user, role, checkProfileComplete]);

  // Show coachmarks based on onboarding state
  useEffect(() => {
    if (!settings || !user || role !== "agent") return;
    if (settings.onboarding_completed) return;
    if (!settings.onboarding_started) return;

    // Determine which coachmark to show
    if (!profileComplete && !coachmarkDismissed.profile) {
      setActiveCoachmark("profile");
    } else if (!settings.preferences_set && !coachmarkDismissed.preferences) {
      setActiveCoachmark("preferences");
    } else if (!settings.notifications_set && !coachmarkDismissed.notifications) {
      setActiveCoachmark("notifications");
    } else {
      setActiveCoachmark(null);
    }
  }, [settings, profileComplete, coachmarkDismissed, user, role]);

  // Check for onboarding completion
  useEffect(() => {
    if (!settings || !user || role !== "agent") return;
    if (settings.onboarding_completed) return;

    if (profileComplete && settings.preferences_set && settings.notifications_set) {
      updateSettings({ onboarding_completed: true });
      toast.success("You're all set. You'll now receive matched opportunities.");
    }
  }, [settings, profileComplete, user, role, updateSettings]);

  const handleGetStarted = async () => {
    await updateSettings({ welcome_modal_dismissed: true, onboarding_started: true });
    setShowWelcomeModal(false);
    navigate("/agent/profile");
  };

  const handleSkip = async () => {
    await updateSettings({ welcome_modal_dismissed: true, onboarding_started: true });
    setShowWelcomeModal(false);
  };

  const handleStepClick = (stepId: "profile" | "preferences" | "notifications") => {
    switch (stepId) {
      case "profile":
        navigate("/agent/profile");
        break;
      case "preferences":
        navigate("/client-needs");
        break;
      case "notifications":
        navigate("/client-needs");
        break;
    }
  };

  const handleCoachmarkAction = () => {
    if (!activeCoachmark) return;
    handleStepClick(activeCoachmark);
    setCoachmarkDismissed((prev) => ({ ...prev, [activeCoachmark]: true }));
    setActiveCoachmark(null);
  };

  const handleCoachmarkDismiss = () => {
    if (!activeCoachmark) return;
    setCoachmarkDismissed((prev) => ({ ...prev, [activeCoachmark]: true }));
    setActiveCoachmark(null);
  };

  const steps = [
    {
      id: "profile" as const,
      label: "Profile",
      description: "so agents know who you are",
      complete: profileComplete,
    },
    {
      id: "preferences" as const,
      label: "Preferences",
      description: "what you want to receive",
      complete: settings?.preferences_set || false,
    },
    {
      id: "notifications" as const,
      label: "Notifications",
      description: "how often we notify you",
      complete: settings?.notifications_set || false,
    },
  ];

  const showSetupBar = 
    user && 
    role === "agent" && 
    settings && 
    !settings.onboarding_completed && 
    settings.onboarding_started;

  const contextValue: OnboardingContextValue = {
    isOnboardingComplete: settings?.onboarding_completed || false,
    profileComplete,
    preferencesSet: settings?.preferences_set || false,
    notificationsSet: settings?.notifications_set || false,
    showSetupBar: !!showSetupBar,
    markProfileComplete: () => checkProfileComplete().then(setProfileComplete),
    markPreferencesComplete: () => updateSettings({ preferences_set: true }),
    markNotificationsComplete: () => updateSettings({ notifications_set: true }),
  };

  // Only show onboarding for agents
  if (role !== "agent") {
    return (
      <OnboardingContext.Provider value={contextValue}>
        {children}
      </OnboardingContext.Provider>
    );
  }

  return (
    <OnboardingContext.Provider value={contextValue}>
      {/* Welcome Modal */}
      <WelcomeModal
        open={showWelcomeModal}
        onGetStarted={handleGetStarted}
        onSkip={handleSkip}
      />

      {/* Setup Bar */}
      {showSetupBar && (
        <SetupBar
          steps={steps}
          onStepClick={handleStepClick}
        />
      )}

      {/* Main Content */}
      {children}

      {/* Coachmark */}
      {activeCoachmark && coachmarkContent[activeCoachmark] && (
        <Coachmark
          title={coachmarkContent[activeCoachmark].title}
          description={coachmarkContent[activeCoachmark].description}
          ctaLabel={coachmarkContent[activeCoachmark].ctaLabel}
          onAction={handleCoachmarkAction}
          onDismiss={handleCoachmarkDismiss}
        />
      )}
    </OnboardingContext.Provider>
  );
};
