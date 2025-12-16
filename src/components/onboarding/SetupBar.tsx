import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SetupStep {
  id: "profile" | "preferences" | "notifications";
  label: string;
  description: string;
  complete: boolean;
}

interface SetupBarProps {
  steps: SetupStep[];
  onStepClick: (stepId: SetupStep["id"]) => void;
  onTourClick?: () => void;
}

export const SetupBar = ({ steps, onStepClick, onTourClick }: SetupBarProps) => {
  const allComplete = steps.every((step) => step.complete);

  if (allComplete) return null;

  return (
    <div className="bg-white border-b border-neutral-200 px-6 py-3">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-neutral-800">Get Set Up</span>
          
          <div className="flex items-center gap-4">
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => onStepClick(step.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all",
                  step.complete
                    ? "bg-neutral-100 text-neutral-500"
                    : "bg-neutral-50 hover:bg-neutral-100 text-neutral-700"
                )}
              >
                {step.complete ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-neutral-300 flex items-center justify-center text-xs text-neutral-400">
                    {index + 1}
                  </span>
                )}
                <span>{step.label}</span>
                {step.complete && (
                  <span className="text-xs text-green-600">Done</span>
                )}
                {!step.complete && (
                  <span className="text-xs text-muted-foreground">Start</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {onTourClick && (
          <button
            onClick={onTourClick}
            className="text-sm text-muted-foreground hover:text-neutral-700 transition-colors"
          >
            Take a quick tour
          </button>
        )}
      </div>
    </div>
  );
};
