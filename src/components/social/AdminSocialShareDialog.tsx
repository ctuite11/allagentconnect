import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { SocialPlatformChoices } from "@/components/social/SocialPlatformChoices";
import {
  fetchSocialConnected,
  hasAnyConnected,
  newClientRequestId,
  openSocialConnectPortal,
  publishListingSocial,
  statusToSocialEventType,
  type SocialConnected,
  type SocialPlatform,
} from "@/lib/socialPublishing";

interface Props {
  listingId: string;
  status: string;
}

/**
 * Admin-only: posts any agent's listing to AAC's own social pages.
 * Accounts come from the signed-in admin's connections (server looks up by caller id),
 * never the listing agent's. Listing social defaults are not read or written.
 * One clientRequestId per dialog open; Retry reuses it (server dedupe).
 */
export function AdminSocialShareDialog({ listingId, status }: Props) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState<SocialConnected | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SocialPlatform[]>([]);
  const [posting, setPosting] = useState(false);
  const [requestId, setRequestId] = useState("");

  useEffect(() => {
    if (!open) return;
    setRequestId(newClientRequestId());
    setSelected([]);
    setLoading(true);
    void fetchSocialConnected().then((c) => {
      setConnected(c);
      setLoading(false);
    });
  }, [open]);

  const handleShare = async () => {
    setPosting(true);
    const ok = await publishListingSocial({
      listingId,
      eventType: statusToSocialEventType(status),
      platforms: selected,
      clientRequestId: requestId,
      failureMessage: "The AAC social post could not be completed.",
    });
    setPosting(false);
    if (ok) setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full text-[13px] font-medium"
        onClick={() => setOpen(true)}
      >
        <Share2 className="mr-2 h-4 w-4" />
        Share to AAC Social
      </Button>
      <Dialog open={open} onOpenChange={(o) => !posting && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share to AAC Social</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Posts on AAC's connected pages. The link opens this listing with the listing agent as the contact.
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading accounts…</p>
          ) : connected && hasAnyConnected(connected) ? (
            <SocialPlatformChoices
              connected={connected}
              selected={selected}
              onChange={setSelected}
              onConnectRequest={(p) => void openSocialConnectPortal(window.location.href, p)}
              disabled={posting}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm">No AAC social accounts are connected.</p>
              <Button variant="outline" onClick={() => void openSocialConnectPortal(window.location.href)}>
                Connect accounts
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={posting}>
              Cancel
            </Button>
            <Button onClick={() => void handleShare()} disabled={posting || selected.length === 0}>
              {posting ? "Sharing…" : "Share"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
