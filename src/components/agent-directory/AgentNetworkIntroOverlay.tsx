import { useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Home, Share2, ShieldCheck, Users } from "lucide-react";
import AACMonogram from "@/components/ui/AACMonogram";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const AGENT_MONOGRAM_CLASS = "text-[#22C55E]";
const AGENT_PRIMARY_BTN_CLASS =
  "bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium";

function IntroBrand() {
  return (
    <div className="flex items-center gap-2 text-zinc-900">
      <AACMonogram className={cn("h-6 w-6", AGENT_MONOGRAM_CLASS)} />
      <div className="min-w-0">
        <div className="text-[13px] font-bold tracking-tight">All Agent Connect</div>
        <div className="text-[10px] font-medium leading-none text-zinc-500">Agent Network</div>
      </div>
    </div>
  );
}

const benefits: { icon: typeof Users; label: string; iconClass: string }[] = [
  {
    icon: Home,
    label: "Be eligible for seller leads",
    iconClass: "text-emerald-600",
  },
  {
    icon: Users,
    label: "Be eligible for buyer leads",
    iconClass: "text-[#0E56F5]",
  },
  {
    icon: Share2,
    label: "Receive in-network referrals",
    iconClass: "text-indigo-600",
  },
  {
    icon: BadgeCheck,
    label: "Build trust with a complete professional profile",
    iconClass: "text-rose-600",
  },
];

type AgentNetworkIntroOverlayProps = {
  open: boolean;
  onLater: (dontShowAgain: boolean) => void;
  onSeeProfile: (dontShowAgain: boolean) => void;
  onUpdateProfile: (dontShowAgain: boolean) => void;
};

export function AgentNetworkIntroOverlay({
  open,
  onLater,
  onSeeProfile,
  onUpdateProfile,
}: AgentNetworkIntroOverlayProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-network-intro-title"
    >
      <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 sm:px-6">
          <IntroBrand />
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            <span>Verified agent</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5 border-b border-zinc-100 p-5 sm:border-b-0 sm:border-r sm:p-6">
            <div className="space-y-2.5">
              <h1
                id="agent-network-intro-title"
                className="text-xl font-semibold leading-snug tracking-tight text-zinc-900 sm:text-[1.35rem]"
              >
                Complete your profile to appear in the Agent Network
              </h1>
              <p className="text-[13px] leading-relaxed text-zinc-500 sm:text-sm">
                Upload a professional headshot and complete your profile to become visible to other
                agents and to be eligible for buyer leads, seller leads, and in-network referrals.
              </p>
            </div>

            <ul className="space-y-2.5">
              {benefits.map(({ icon: Icon, label, iconClass }) => (
                <li key={label} className="flex items-start gap-2.5 text-[13px] text-zinc-700">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-100 bg-zinc-50">
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
                  Review and update your profile
                </h2>
                <p className="text-[13px] leading-relaxed text-zinc-500">
                  Verified agents without a headshot or complete profile are hidden from this
                  directory until their profile is ready. Review yours or update Profile &amp;
                  Branding to become visible.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => onSeeProfile(dontShowAgain)}
                className={cn("h-10 w-full rounded-xl text-[13px]", AGENT_PRIMARY_BTN_CLASS)}
              >
                See My Profile
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => onUpdateProfile(dontShowAgain)}
                className="h-10 w-full rounded-xl border-zinc-200 bg-white text-[13px] text-zinc-700 hover:bg-zinc-50"
              >
                Update My Profile
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => onLater(dontShowAgain)}
                className="h-10 w-full rounded-xl border-zinc-200 bg-white text-[13px] text-zinc-700 hover:bg-zinc-50"
              >
                Maybe Later
              </Button>

              <div className="flex items-start gap-2.5 pt-0.5">
                <Checkbox
                  id="agent-network-intro-dismiss"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                />
                <Label
                  htmlFor="agent-network-intro-dismiss"
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
