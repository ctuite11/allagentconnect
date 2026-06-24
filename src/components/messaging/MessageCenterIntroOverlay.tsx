import { useState } from "react";
import { createPortal } from "react-dom";
import { Mail, MessageSquare, ShieldCheck, Zap } from "lucide-react";
import AACMonogram from "@/components/ui/AACMonogram";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const AGENT_MONOGRAM_CLASS = "text-[#22C55E]";
const AGENT_PRIMARY_BTN_CLASS =
  "bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium";

function IntroBrand({ contextLabel }: { contextLabel: string }) {
  return (
    <div className="flex items-center gap-2 text-zinc-900">
      <AACMonogram className={cn("h-6 w-6", AGENT_MONOGRAM_CLASS)} />
      <div className="min-w-0">
        <div className="text-[13px] font-bold tracking-tight">All Agent Connect</div>
        <div className="text-[10px] font-medium leading-none text-zinc-500">{contextLabel}</div>
      </div>
    </div>
  );
}

const benefits: { icon: typeof MessageSquare; label: string; iconClass: string }[] = [
  {
    icon: Zap,
    label: "Send and receive instant messages while you're online",
    iconClass: "text-[#0E56F5]",
  },
  {
    icon: Mail,
    label: "If the recipient isn't online, they'll receive an email notification.",
    iconClass: "text-emerald-600",
  },
  {
    icon: MessageSquare,
    label: "Never miss an important conversation",
    iconClass: "text-indigo-600",
  },
];

type MessageCenterIntroOverlayProps = {
  open: boolean;
  variant?: "agent" | "buyer";
  onLater: (dontShowAgain: boolean) => void;
  onStartMessaging: (dontShowAgain: boolean) => void;
};

export function MessageCenterIntroOverlay({
  open,
  variant = "agent",
  onLater,
  onStartMessaging,
}: MessageCenterIntroOverlayProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const isAgent = variant === "agent";

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-center-intro-title"
    >
      <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 sm:px-6">
          <IntroBrand contextLabel="Message Center" />
          {isAgent ? (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              <span>Verified agent</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="space-y-2.5">
            <h1
              id="message-center-intro-title"
              className="text-xl font-semibold leading-snug tracking-tight text-zinc-900 sm:text-[1.35rem]"
            >
              Your Message Center
            </h1>
            <p className="text-[13px] leading-relaxed text-zinc-600 sm:text-sm">
              {isAgent
                ? "Stay connected with clients and colleagues in one place — real-time when you're online, email when you're not."
                : "Stay connected with your agent in one place — real-time when you're online, email when you're not."}
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

          <div className="space-y-2.5 border-t border-zinc-100 pt-5">
            <Button
              type="button"
              onClick={() => onStartMessaging(dontShowAgain)}
              className={cn("h-10 w-full rounded-xl text-[13px]", AGENT_PRIMARY_BTN_CLASS)}
            >
              Start Messaging
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
                id="message-center-intro-dismiss"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label
                htmlFor="message-center-intro-dismiss"
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
