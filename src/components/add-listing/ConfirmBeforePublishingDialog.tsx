import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SocialPlatformChoices } from "@/components/social/SocialPlatformChoices";
import type { SocialConnected, SocialPlatform } from "@/lib/socialPublishing";

type ConfirmBeforePublishingDialogProps = {
  open: boolean;
  statusLabel: string;
  address: string;
  price: string;
  coverPhotoUrl?: string | null;
  propertyType?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  /** Optional social choices; null/undefined hides the section. */
  social?: {
    connected: SocialConnected;
    status?: "loading" | "ready" | "error";
    selected: SocialPlatform[];
    onChange: (next: SocialPlatform[]) => void;
    /** First-publish review only: starts authorization for a not-connected platform. */
    onConnectRequest?: (platform: SocialPlatform) => void;
  } | null;
  onGoBack: () => void;
  onConfirm: () => void;
};

/**
 * "Ready to publish?" — final review before a listing goes live for the first time.
 * Shown after validation; does not persist anything itself.
 */
export function ConfirmBeforePublishingDialog({
  open,
  statusLabel,
  address,
  price,
  coverPhotoUrl,
  propertyType,
  beds,
  baths,
  sqft,
  social,
  onGoBack,
  onConfirm,
}: ConfirmBeforePublishingDialogProps) {
  const vitals = [
    beds ? `${beds} Beds` : null,
    baths ? `${baths} Baths` : null,
    sqft ? `${sqft} Sq Ft` : null,
  ].filter(Boolean);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onGoBack();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ready to publish?</DialogTitle>
        </DialogHeader>

        {coverPhotoUrl ? (
          <div className="relative overflow-hidden rounded-lg border bg-muted">
            <img src={coverPhotoUrl} alt="Cover photo" className="h-48 w-full object-cover" />
            <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground">
              Cover Photo
            </span>
          </div>
        ) : null}

        <div className="space-y-1">
          <p className="text-lg font-semibold leading-snug text-foreground">{address}</p>
          {propertyType ? <p className="text-sm text-muted-foreground">{propertyType}</p> : null}
          <p className="text-sm text-foreground">{vitals.length ? vitals.join(" | ") : "Beds | Baths | Sq Ft not entered"}</p>
          <p className="pt-1 text-sm text-muted-foreground">
            {price} · {statusLabel}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Publishing will make this listing live and may send Hot Sheet alerts to matching agents.
        </p>

        {social ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Share on social media</p>
            <SocialPlatformChoices
              connected={social.connected}
              status={social.status}
              selected={social.selected}
              onChange={social.onChange}
              onConnectRequest={social.onConnectRequest}
            />
            <p className="text-xs text-muted-foreground">
              Leave all unchecked to publish without sharing. These become this listing's defaults.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onGoBack}>
            Go Back / Edit
          </Button>
          <Button type="button" onClick={onConfirm}>
            Yes, Publish Listing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
