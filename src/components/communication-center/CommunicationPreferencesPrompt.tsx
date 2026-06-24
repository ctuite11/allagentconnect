import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Radio, ShieldCheck } from "lucide-react";
import AACMonogram from "@/components/ui/AACMonogram";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const AGENT_MONOGRAM_CLASS = "text-[#22C55E]";
const AGENT_PRIMARY_BTN_CLASS =
  "bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium";

function OnboardingBrand() {
  return (
    <div className="flex items-center gap-2 text-zinc-900">
      <AACMonogram className={cn("h-6 w-6", AGENT_MONOGRAM_CLASS)} />
      <div className="min-w-0">
        <div className="text-[13px] font-bold tracking-tight">All Agent Connect</div>
        <div className="text-[10px] font-medium leading-none text-zinc-500">Success Hub</div>
      </div>
    </div>
  );
}

type CommunicationPreferencesPromptProps = {
  open: boolean;
  onClose: () => void;
};

export function CommunicationPreferencesPrompt({ open, onClose }: CommunicationPreferencesPromptProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const handleGoToCommunicationsCenter = () => {
    onClose();
    navigate(ROUTES.COMMUNICATIONS, { state: { scrollToPreferences: true } });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="communication-preferences-prompt-title"
    >
      <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 sm:px-6">
          <OnboardingBrand />
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            <span>Verified agent</span>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50">
              <Radio className="h-4 w-4 text-emerald-600" aria-hidden />
            </span>
            <div className="min-w-0 space-y-2.5">
              <h1
                id="communication-preferences-prompt-title"
                className="text-xl font-semibold leading-snug tracking-tight text-zinc-900 sm:text-[1.35rem]"
              >
                Target the right agents and streamline your inbox
              </h1>
              <p className="text-[13px] leading-relaxed text-zinc-600 sm:text-sm">
                Set your Communications Center preferences to send updates to the right agents and
                receive only the notifications that matter most to you.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-zinc-100 pt-5">
            <Button
              type="button"
              onClick={handleGoToCommunicationsCenter}
              className={cn("h-10 w-full rounded-xl text-[13px]", AGENT_PRIMARY_BTN_CLASS)}
            >
              Go to Communications Center
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 w-full rounded-xl border-zinc-200 bg-white text-[13px] text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
