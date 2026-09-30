import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onCancel: () => void;
  onContinue: () => void;
}

/** Shown before the hosted publishing-authorization page opens. */
export function ConnectSocialExplainerDialog({ open, onCancel, onContinue }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Connect social media for publishing</DialogTitle>
          <DialogDescription>
            All Agent Connect uses Bundle to securely connect your social accounts for listing publishing. Your
            profile social links are separate and do not provide publishing permission.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onContinue}>
            Continue to Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
