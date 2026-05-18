import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getHotSheetReviewShareUrl } from "@/lib/getPublicUrl";
import { Facebook, Link2, Linkedin, Mail, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";
import {
  PersonalHotSheetShareEmailDialog,
  type PersonalHotSheetShareListingPreview,
} from "@/components/share/PersonalHotSheetShareEmailDialog";

type PersonalHotSheetShareActionsProps = {
  hotSheetId: string;
  title: string;
  selectedListingIds: string[];
  selectedListingPreviews?: PersonalHotSheetShareListingPreview[];
};

const SHARE_DISABLED_HINT = "Select at least one listing to share";

const reviewControlBtn =
  "h-8 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50/90 disabled:pointer-events-none disabled:opacity-50 disabled:hover:border-neutral-200 disabled:hover:bg-white";

function selectedShareDescription(count: number): string {
  return `${count} selected listing${count === 1 ? "" : "s"} on All Agent Connect`;
}

export function PersonalHotSheetShareActions({
  hotSheetId,
  title,
  selectedListingIds,
  selectedListingPreviews = [],
}: PersonalHotSheetShareActionsProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const canShare = selectedListingIds.length > 0;
  const selectedCount = selectedListingIds.length;
  const description = canShare ? selectedShareDescription(selectedCount) : "";

  const url = getHotSheetReviewShareUrl(hotSheetId);
  const encodedUrl = encodeURIComponent(url);
  const socialText = canShare
    ? encodeURIComponent(`${title} — ${selectedShareDescription(selectedCount)}`)
    : encodeURIComponent(title);
  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${socialText}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  } as const;

  useEffect(() => {
    if (!canShare) {
      setEmailOpen(false);
      setSocialOpen(false);
    }
  }, [canShare]);

  const handleCopyLink = async () => {
    if (!canShare) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleSocialShare = (platform: keyof typeof shareLinks) => {
    if (!canShare) return;
    window.open(shareLinks[platform], "_blank", "noopener,noreferrer,width=600,height=400");
  };

  return (
    <>
      <div role="group" aria-label="Share hot sheet results" className="flex flex-wrap items-center gap-2">
        <span className="hidden text-[12px] font-medium text-neutral-500 sm:inline">Share</span>
        <Button
          type="button"
          variant="outline"
          className={reviewControlBtn}
          disabled={!canShare}
          onClick={() => canShare && setEmailOpen(true)}
        >
          <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden strokeWidth={2} />
          Email
        </Button>
        <Button
          type="button"
          variant="outline"
          className={reviewControlBtn}
          disabled={!canShare}
          onClick={() => void handleCopyLink()}
        >
          <Link2 className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden strokeWidth={2} />
          Copy link
        </Button>
        <DropdownMenu
          open={canShare ? socialOpen : false}
          onOpenChange={(open) => {
            if (canShare) setSocialOpen(open);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className={reviewControlBtn} disabled={!canShare}>
              <Share2 className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden strokeWidth={2} />
              Social
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl border border-neutral-200 bg-white shadow-md">
            <DropdownMenuItem onClick={() => handleSocialShare("facebook")} className="cursor-pointer gap-2 text-[13px]">
              <Facebook className="h-4 w-4 shrink-0" aria-hidden />
              Facebook
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSocialShare("linkedin")} className="cursor-pointer gap-2 text-[13px]">
              <Linkedin className="h-4 w-4 shrink-0" aria-hidden />
              LinkedIn
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSocialShare("twitter")} className="cursor-pointer gap-2 text-[13px]">
              <Twitter className="h-4 w-4 shrink-0" aria-hidden />
              X (Twitter)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!canShare ? (
          <span className="w-full text-[11px] leading-snug text-neutral-500 sm:w-auto">{SHARE_DISABLED_HINT}</span>
        ) : null}
      </div>

      {canShare ? (
        <PersonalHotSheetShareEmailDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          hotSheetId={hotSheetId}
          title={title}
          description={description}
          selectedListingIds={selectedListingIds}
          selectedListingPreviews={selectedListingPreviews}
        />
      ) : null}
    </>
  );
}
