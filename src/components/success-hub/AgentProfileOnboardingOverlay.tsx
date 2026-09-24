import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, Flame, Radio, ShieldCheck, UserCircle } from "lucide-react";
import AACMonogram from "@/components/ui/AACMonogram";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const AGENT_PROFILE_ONBOARDING_SESSION_KEY = "aac_agent_profile_onboarding_later";

export type SetupChecklistCompletion = {
  communications: boolean;
  profile: boolean;
  hotSheet: boolean;
};

const AGENT_MONOGRAM_CLASS = "text-[#22C55E]";
const AGENT_PRIMARY_BTN_CLASS =
  "bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium";

const COMMUNICATIONS_PATH = "/communications";
const HOT_SHEETS_PATH = "/agent/hot-sheets";

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

type StepKey = keyof SetupChecklistCompletion;

function buildSteps(agentUserId: string): {
  key: StepKey;
  step: number;
  title: string;
  description: string;
  cta: string;
  path: string;
  icon: typeof Radio;
  iconClass: string;
}[] {
  return [
    {
      key: "communications",
      step: 1,
      title: "Communications",
      description:
        "Choose what you want to hear about so you receive the opportunities and updates that matter to you.",
      cta: "Set Communications",
      path: COMMUNICATIONS_PATH,
      icon: Radio,
      iconClass: "text-emerald-600",
    },
    {
      key: "profile",
      step: 2,
      title: "Complete Your Profile",
      description:
        "Make sure your profile is complete so other agents can find you, recognize you, and connect with you.",
      cta: "Complete Profile",
      // Land on the agent's normal profile view first; Edit Profile is on that page.
      path: `/agent/${agentUserId}`,
      icon: UserCircle,
      iconClass: "text-[#0E56F5]",
    },
    {
      key: "hotSheet",
      step: 3,
      title: "Create a Hot Sheet",
      description:
        "Tell us what your buyers are looking for so you can be matched with Off Market and Coming Soon opportunities.",
      cta: "Create Hot Sheet",
      path: HOT_SHEETS_PATH,
      icon: Flame,
      iconClass: "text-amber-600",
    },
  ];
}

type AgentProfileOnboardingOverlayProps = {
  completion: SetupChecklistCompletion;
  /** Signed-in agent id — used for the Profile CTA (`/agent/:userId`). */
  agentUserId: string;
  /** True only for the first checklist appearance right after activation. */
  isPostActivationWelcome?: boolean;
  onLater: (dontShowAgain: boolean) => void;
  onStepNavigate: (dontShowAgain: boolean) => void;
};

export function AgentProfileOnboardingOverlay({
  completion,
  agentUserId,
  isPostActivationWelcome = false,
  onLater,
  onStepNavigate,
}: AgentProfileOnboardingOverlayProps) {
  const navigate = useNavigate();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const steps = buildSteps(agentUserId);

  const handleStep = (path: string) => {
    onStepNavigate(dontShowAgain);
    navigate(path);
  };

  const handleLater = () => {
    onLater(dontShowAgain);
  };

  const doneCount = steps.filter((s) => completion[s.key]).length;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-profile-onboarding-title"
    >
      <div className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 sm:px-6">
          <OnboardingBrand />
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            <span>
              {doneCount}/3 complete
            </span>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="space-y-2">
            <h1
              id="agent-profile-onboarding-title"
              className="text-xl font-semibold leading-snug tracking-tight text-zinc-900 sm:text-[1.35rem]"
            >
              {isPostActivationWelcome
                ? "Welcome to All Agent Connect"
                : "Complete your All Agent Connect setup"}
            </h1>
            <p className="text-[13px] leading-relaxed text-zinc-500 sm:text-sm">
              {isPostActivationWelcome
                ? "Your account is active. Complete these three quick setup steps so you can get the most from your membership and start seeing opportunities across the network."
                : "Finish the remaining steps so you can get the most from your membership and opportunities across the network."}
            </p>
          </div>

          <ol className="space-y-3">
            {steps.map(({ key, step, title, description, cta, path, icon: Icon, iconClass }) => {
              const done = completion[key];
              return (
                <li
                  key={key}
                  className={cn(
                    "rounded-xl border p-3.5 sm:p-4",
                    done
                      ? "border-emerald-100 bg-emerald-50/50"
                      : "border-zinc-100 bg-zinc-50/70",
                  )}
                >
                  <div className="flex gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                        done
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                          : "border-zinc-200 bg-white text-zinc-700",
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step}
                    </span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={cn("h-3.5 w-3.5", done ? "text-emerald-600" : iconClass)}
                            aria-hidden
                          />
                          <h2 className="text-[14px] font-semibold tracking-tight text-zinc-900">
                            {title}
                          </h2>
                          {done ? (
                            <span className="text-[11px] font-medium text-emerald-700">Done</span>
                          ) : null}
                        </div>
                        <p className="text-[12.5px] leading-relaxed text-zinc-500 sm:text-[13px]">
                          {description}
                        </p>
                      </div>
                      {done ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleStep(path)}
                          className="h-9 w-full rounded-xl border-zinc-200 bg-white text-[12.5px] text-zinc-600 hover:bg-zinc-50 sm:w-auto sm:px-4"
                        >
                          Review
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => handleStep(path)}
                          className={cn(
                            "h-9 w-full rounded-xl text-[12.5px] sm:w-auto sm:px-4",
                            AGENT_PRIMARY_BTN_CLASS,
                          )}
                        >
                          {cta}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="space-y-3 border-t border-zinc-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleLater}
              className="h-10 w-full rounded-xl border-zinc-200 bg-white text-[13px] text-zinc-700 hover:bg-zinc-50"
            >
              Maybe Later
            </Button>

            <div className="flex items-start gap-2.5">
              <Checkbox
                id="agent-profile-onboarding-dismiss"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label
                htmlFor="agent-profile-onboarding-dismiss"
                className="cursor-pointer text-[12px] font-normal leading-snug text-zinc-600"
              >
                Don&apos;t show this again
              </Label>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
