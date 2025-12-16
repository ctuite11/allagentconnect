import { ReactNode } from "react";
import { useAuthRole } from "@/hooks/useAuthRole";
import { OnboardingProvider } from "@/components/onboarding";

interface AppOnboardingWrapperProps {
  children: ReactNode;
}

export const AppOnboardingWrapper = ({ children }: AppOnboardingWrapperProps) => {
  const { user, role, loading } = useAuthRole();

  // Don't render onboarding provider while loading auth
  if (loading) {
    return <>{children}</>;
  }

  return (
    <OnboardingProvider user={user} role={role}>
      {children}
    </OnboardingProvider>
  );
};
