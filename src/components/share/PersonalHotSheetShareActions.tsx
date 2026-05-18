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

type PersonalHotSheetShareActionsProps = {
  hotSheetId: string;
  title: string;
  /** Optional subtitle for social / email body (e.g. match count). */
  description?: string;
};

const reviewControlBtn =
  "h-8 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50/90";

export function PersonalHotSheetShareActions({
  hotSheetId,
  title,
  description = "",
}: PersonalHotSheetShareActionsProps) {
  const url = getHotSheetReviewShareUrl(hotSheetId);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  } as const;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Hot Sheet: ${title}`);
    const body = encodeURIComponent(
      [description, "", `View matches: ${url}`].filter(Boolean).join("\n"),
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleSocialShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], "_blank", "noopener,noreferrer,width=600,height=400");
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Share hot sheet results"
    >
      <span className="hidden text-[12px] font-medium text-neutral-500 sm:inline">Share</span>
      <Button type="button" variant="outline" className={reviewControlBtn} onClick={handleEmailShare}>
        <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden strokeWidth={2} />
        Email
      </Button>
      <Button type="button" variant="outline" className={reviewControlBtn} onClick={() => void handleCopyLink()}>
        <Link2 className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden strokeWidth={2} />
        Copy link
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className={reviewControlBtn}>
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
    </div>
  );
}
