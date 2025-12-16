import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoachmarkProps {
  title: string;
  description: string;
  ctaLabel: string;
  onAction: () => void;
  onDismiss: () => void;
}

export const Coachmark = ({
  title,
  description,
  ctaLabel,
  onAction,
  onDismiss,
}: CoachmarkProps) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-white border border-neutral-200 rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom-4 duration-300">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="space-y-3 pr-6">
        <h4 className="font-medium text-neutral-800">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button onClick={onAction} size="sm">
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
};

// Coachmark content for each step
export const coachmarkContent = {
  profile: {
    title: "Complete your profile",
    description: "Agents respond more when they know who you are.",
    ctaLabel: "Edit Profile",
  },
  preferences: {
    title: "Tell us what to send you",
    description: "Choose markets, property types, and price ranges.",
    ctaLabel: "Set Preferences",
  },
  notifications: {
    title: "Choose your alert frequency",
    description: "Immediate works best in competitive markets.",
    ctaLabel: "Set Notifications",
  },
};
