import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Facebook, Linkedin, Mail, MessageCircle, Link2 } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import { toast } from "sonner";
import { ShareListingDialog } from "@/components/ShareListingDialog";
import { trackShare } from "@/lib/trackShare";
import { privacyRpc } from "@/lib/privacyApi";
import { getPublicOrigin } from "@/lib/getPublicUrl";

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

  const getSecureUrl = async () => {
    if (!listingId) return url;
    const token = await privacyRpc<string>("create_listing_share_link", { p_listing_id: listingId });
    return `${getPublicOrigin().replace(/\/$/, "")}/s/${token}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(await getSecureUrl());
      toast.success("Link copied to clipboard");
      if (listingId) await trackShare(listingId, "copy_link");
    } catch { toast.error("External sharing must be authorized by the listing agent first."); }
  };

  const handleSocialShare = async (platform: "facebook" | "twitter" | "linkedin" | "whatsapp") => {
    try {
      const link = encodeURIComponent(await getSecureUrl());
      const shareTitle = listingId ? encodeURIComponent("Private shared listing") : encodedTitle;
      const shareLinks = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${link}`,
        twitter: `https://x.com/intent/post?url=${link}&text=${shareTitle}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${link}`,
        whatsapp: `https://wa.me/?text=${shareTitle}%20${link}`,
      };
      window.open(shareLinks[platform], "_blank", "noopener,noreferrer,width=600,height=400");
      if (listingId) await trackShare(listingId, platform);
    } catch { toast.error("External sharing must be authorized by the listing agent first."); }
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
            <XIcon className="h-4 w-4 shrink-0 text-neutral-600" />
            X
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
