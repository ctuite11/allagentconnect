import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Facebook, Twitter, Linkedin, Mail, MessageCircle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { ShareListingDialog } from "@/components/ShareListingDialog";

interface SocialShareMenuProps {
  url: string;
  title: string;
  description?: string;
  listingId?: string;
  /** Required when `listingId` is set — used for the AAC email share dialog. */
  listingAddress?: string;
  /** `buyer` loads `profiles`; default `agent` uses `agent_profiles`. */
  senderProfileSource?: "agent" | "buyer";
  trigger?: React.ReactNode;
}

const shareMenuItemClass =
  "cursor-pointer gap-2 text-[13px] text-neutral-800 focus:bg-neutral-100 focus:text-neutral-900 data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-900";

const SocialShareMenu = ({
  url,
  title,
  description = "",
  listingId,
  listingAddress = "",
  senderProfileSource = "agent",
  trigger,
}: SocialShareMenuProps) => {
  const [emailOpen, setEmailOpen] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
  };

  const handleCopyLink = async () => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");

    if (listingId) {
      const { trackShare } = await import("@/lib/trackShare");
      await trackShare(listingId, "copy_link");
    }
  };

  const handleSocialShare = async (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], "_blank", "noopener,noreferrer,width=600,height=400");

    if (listingId) {
      const { trackShare } = await import("@/lib/trackShare");
      await trackShare(listingId, platform);
    }
  };

  const handleEmailShare = () => {
    if (listingId) {
      setEmailOpen(true);
      return;
    }
    const mailto = `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`;
    window.open(mailto, "_blank");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || (
            <Button variant="secondary" size="lg" className="gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 rounded-xl border border-neutral-200 bg-white shadow-md"
        >
          <DropdownMenuItem
            onClick={() => void handleSocialShare("facebook")}
            className={shareMenuItemClass}
          >
            <Facebook className="h-4 w-4 shrink-0 text-neutral-600" />
            Facebook
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void handleSocialShare("twitter")}
            className={shareMenuItemClass}
          >
            <Twitter className="h-4 w-4 shrink-0 text-neutral-600" />
            Twitter
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void handleSocialShare("linkedin")}
            className={shareMenuItemClass}
          >
            <Linkedin className="h-4 w-4 shrink-0 text-neutral-600" />
            LinkedIn
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void handleSocialShare("whatsapp")}
            className={shareMenuItemClass}
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-neutral-600" />
            WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEmailShare} className={shareMenuItemClass}>
            <Mail className="h-4 w-4 shrink-0 text-neutral-600" />
            Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleCopyLink()} className={shareMenuItemClass}>
            <Link2 className="h-4 w-4 shrink-0 text-neutral-600" />
            Copy Link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {listingId ? (
        <ShareListingDialog
          listingId={listingId}
          listingAddress={listingAddress || title}
          senderProfileSource={senderProfileSource}
          open={emailOpen}
          onOpenChange={setEmailOpen}
        />
      ) : null}
    </>
  );
};

export default SocialShareMenu;
