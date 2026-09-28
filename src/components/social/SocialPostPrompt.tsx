import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SocialPlatformChoices } from "@/components/social/SocialPlatformChoices";
import type { SocialConnected, SocialPlatform } from "@/lib/socialPublishing";

interface Props {
  open: boolean;
  connected: SocialConnected;
  /** Pre-checked from the listing's saved defaults. Changes here apply to this post only. */
  initialSelected: SocialPlatform[];
  posting: boolean;
  onSkip: () => void;
  onPost: (platforms: SocialPlatform[]) => void;
}

/** Shown after an eligible edit of a live listing has already been saved. */
export function SocialPostPrompt({ open, connected, initialSelected, posting, onSkip, onPost }: Props) {
  const [selected, setSelected] = useState<SocialPlatform[]>(initialSelected);
  useEffect(() => {
    if (open) setSelected(initialSelected.filter((p) => connected[p]));
  }, [open, initialSelected, connected]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !posting) onSkip(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share this update?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Your changes are saved. Choose where to share this update. These choices apply to this post only.
        </p>
        <SocialPlatformChoices connected={connected} selected={selected} onChange={setSelected} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onSkip} disabled={posting}>
            Skip
          </Button>
          <Button type="button" onClick={() => onPost(selected)} disabled={posting || selected.length === 0}>
            {posting ? "Sharing…" : "Share"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
