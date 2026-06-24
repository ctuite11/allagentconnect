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
    <div className="flex items-center gap-2 text-zinc-900">
      <AACMonogram className={cn("h-6 w-6", AGENT_MONOGRAM_CLASS)} />
      <div className="min-w-0">
        <div className="text-[13px] font-bold tracking-tight">All Agent Connect</div>
        <div className="text-[10px] font-medium leading-none text-zinc-500">Success Hub</div>
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
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-profile-onboarding-title"
    >
      <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 sm:px-6">
          <OnboardingBrand />
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            <span>Verified agent</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5 border-b border-zinc-100 p-5 sm:border-b-0 sm:border-r sm:p-6">
            <div className="space-y-2.5">
              <h1
                id="agent-profile-onboarding-title"
                className="text-xl font-semibold leading-snug tracking-tight text-zinc-900 sm:text-[1.35rem]"
              >
                Complete Your Agent Profile
              </h1>
              <p className="text-[13px] leading-relaxed text-zinc-500 sm:text-sm">
                Your profile is how buyers and other agents discover and evaluate you on All Agent
                Connect. Completing it ensures you&apos;re eligible to receive buyer leads, seller
                leads, and in-network referrals.
              </p>
            </div>

            <ul className="space-y-2.5">
              {benefits.map(({ icon: Icon, label, iconClass }) => (
                <li key={label} className="flex items-center gap-2.5 text-[13px] text-zinc-700">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-100 bg-zinc-50">
                    <Icon className={cn("h-3.5 w-3.5", iconClass)} aria-hidden />
                  </span>
                  <span className="leading-snug">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-zinc-50/60 p-5 sm:p-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
                  Complete your agent profile
                </h2>
                <p className="text-[13px] leading-relaxed text-zinc-500">
                  Your agent profile helps other agents and buyers know who they are working with.
                  Agents with incomplete profiles may not be eligible to receive seller leads,
                  buyer leads, or in-network referrals.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleCompleteProfile}
                className={cn("h-10 w-full rounded-xl text-[13px]", AGENT_PRIMARY_BTN_CLASS)}
              >
                Complete My Profile
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleLater}
                className="h-10 w-full rounded-xl border-zinc-200 bg-white text-[13px] text-zinc-700 hover:bg-zinc-50"
              >
                Maybe Later
              </Button>

              <div className="flex items-start gap-2.5 pt-0.5">
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
      </div>
    </div>,
    document.body,
  );
}
