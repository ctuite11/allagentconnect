import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, ShieldCheck, TrendingUp, UserCheck, Users } from "lucide-react";
import AACMonogram from "@/components/ui/AACMonogram";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PROFILE_EDITOR_PATH = "/agent-profile-editor";
export const AGENT_PROFILE_ONBOARDING_SESSION_KEY = "aac_agent_profile_onboarding_later";

const AGENT_MONOGRAM_CLASS = "text-[#22C55E]";
const AGENT_PRIMARY_BTN_CLASS =
  "bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium";

function OnboardingBrand() {
  return (
    <div className="flex items-center gap-2.5 text-zinc-900">
      <AACMonogram className={cn("h-7 w-7", AGENT_MONOGRAM_CLASS)} />
      <div className="min-w-0">
        <div className="text-[15px] font-bold tracking-tight">All Agent Connect</div>
        <div className="mt-0.5 text-[11px] font-medium leading-none text-zinc-500">Success Hub</div>
      </div>
    </div>
  );
}

const benefits: { icon: typeof Users; label: string; iconClass: string }[] = [
  { icon: Users, label: "Receive buyer leads", iconClass: "text-emerald-600" },
  { icon: TrendingUp, label: "Receive seller leads", iconClass: "text-[#0E56F5]" },
  { icon: UserCheck, label: "Receive in-network referrals", iconClass: "text-indigo-600" },
  { icon: BadgeCheck, label: "Build credibility with a complete professional profile", iconClass: "text-amber-600" },
];

type AgentProfileOnboardingOverlayProps = {
  onLater: (dontShowAgain: boolean) => void;
  onCompleteProfile: () => void;
};

export function AgentProfileOnboardingOverlay({
  onLater,
  onCompleteProfile,
}: AgentProfileOnboardingOverlayProps) {
  const navigate = useNavigate();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleCompleteProfile = () => {
    onCompleteProfile();
    navigate(PROFILE_EDITOR_PATH);
  };

  const handleLater = () => {
    onLater(dontShowAgain);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-profile-onboarding-title"
    >
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <OnboardingBrand />
          <div className="hidden items-center gap-1.5 text-[12px] text-zinc-500 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            <span>Verified agent</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 lg:py-20">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-8 lg:pt-4">
            <div className="space-y-4">
              <h1
                id="agent-profile-onboarding-title"
                className="text-3xl font-semibold leading-[1.15] tracking-tight text-zinc-900 sm:text-4xl"
              >
                Complete Your Agent Profile
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-zinc-500 sm:text-base">
                Your profile is how buyers and other agents discover and evaluate you on All Agent
                Connect. Completing it ensures you&apos;re eligible to receive buyer leads, seller
                leads, and in-network referrals.
              </p>
            </div>

            <ul className="space-y-3">
              {benefits.map(({ icon: Icon, label, iconClass }) => (
                <li key={label} className="flex items-center gap-3 text-[14px] text-zinc-700">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-100 bg-zinc-50">
                    <Icon className={cn("h-4 w-4", iconClass)} aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:-mt-7 lg:pl-4">
            <div className="mx-auto max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-8 lg:mx-0 lg:ml-auto">
              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                    Complete your agent profile
                  </h2>
                  <p className="text-[14px] leading-relaxed text-zinc-500">
                    Your agent profile helps other agents and buyers know who they are working with.
                    Agents with incomplete profiles may not be eligible to receive seller leads,
                    buyer leads, or in-network referrals.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleCompleteProfile}
                  className={cn("h-11 w-full rounded-xl", AGENT_PRIMARY_BTN_CLASS)}
                >
                  Complete My Profile
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLater}
                  className="h-11 w-full rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  Maybe Later
                </Button>

                <div className="flex items-start gap-2.5 pt-1">
                  <Checkbox
                    id="agent-profile-onboarding-dismiss"
                    checked={dontShowAgain}
                    onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                  />
                  <Label
                    htmlFor="agent-profile-onboarding-dismiss"
                    className="cursor-pointer text-[13px] font-normal leading-snug text-zinc-600"
                  >
                    Don&apos;t show this again
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>,
    document.body,
  );
}
