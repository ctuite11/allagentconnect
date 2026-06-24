import { useState } from "react";
import { createPortal } from "react-dom";
import { Globe, Layers, MousePointerClick, ShieldCheck } from "lucide-react";
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
        <div className="text-[10px] font-medium leading-none text-zinc-500">Add Listing</div>
      </div>
    </div>
  );
}

const benefits: { icon: typeof Globe; label: string; iconClass: string }[] = [
  {
    icon: Globe,
    label: "Reach consumers directly through Direct Connect MLS",
    iconClass: "text-emerald-600",
  },
  {
    icon: Layers,
    label: "Manage both agent and consumer exposure from one listing",
    iconClass: "text-[#0E56F5]",
  },
  {
    icon: MousePointerClick,
    label: "Publish with a single click when the feature launches",
    iconClass: "text-indigo-600",
  },
];

type DcmlsPublishingIntroOverlayProps = {
  open: boolean;
  onGotIt: (dontShowAgain: boolean) => void;
};

export function DcmlsPublishingIntroOverlay({ open, onGotIt }: DcmlsPublishingIntroOverlayProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-listing-dcmls-intro-title"
    >
      <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 sm:px-6">
          <IntroBrand />
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            <span>Verified agent</span>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="space-y-2.5">
            <h1
              id="add-listing-dcmls-intro-title"
              className="text-xl font-semibold leading-snug tracking-tight text-zinc-900 sm:text-[1.35rem]"
            >
              Coming Soon: Publish to Direct Connect MLS
            </h1>
            <p className="text-[13px] leading-relaxed text-zinc-600 sm:text-sm">
              <span className="font-medium text-zinc-800">Direct Connect MLS</span> is our
              consumer-facing partner platform. Soon you&apos;ll be able to publish your AAC listings
              directly to consumers with a single click while continuing to manage everything from
              All Agent Connect.
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
              onClick={() => onGotIt(dontShowAgain)}
              className={cn("h-10 w-full rounded-xl text-[13px]", AGENT_PRIMARY_BTN_CLASS)}
            >
              Got it
            </Button>

            <div className="flex items-start gap-2.5 pt-0.5">
              <Checkbox
                id="add-listing-dcmls-intro-dismiss"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label
                htmlFor="add-listing-dcmls-intro-dismiss"
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
