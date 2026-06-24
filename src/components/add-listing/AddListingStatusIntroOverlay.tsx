import { useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";
import AACMonogram from "@/components/ui/AACMonogram";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AddListingStatusHelpContent } from "@/components/add-listing/AddListingStatusHelpContent";
import { ADD_LISTING_STATUS_INTRO } from "@/lib/addListingStatusHelp";
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

type AddListingStatusIntroOverlayProps = {
  open: boolean;
  onGotIt: (dontShowAgain: boolean) => void;
};

export function AddListingStatusIntroOverlay({ open, onGotIt }: AddListingStatusIntroOverlayProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-listing-status-intro-title"
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
          <h1
            id="add-listing-status-intro-title"
            className="text-xl font-semibold leading-snug tracking-tight text-zinc-900 sm:text-[1.35rem]"
          >
            {ADD_LISTING_STATUS_INTRO.title}
          </h1>

          <AddListingStatusHelpContent variant="modal" />

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
                id="add-listing-status-intro-dismiss"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label
                htmlFor="add-listing-status-intro-dismiss"
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
