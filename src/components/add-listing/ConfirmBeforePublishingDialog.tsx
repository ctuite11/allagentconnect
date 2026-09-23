import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmBeforePublishingDialogProps = {
  open: boolean;
  statusLabel: string;
  address: string;
  price: string;
  onGoBack: () => void;
  onConfirm: () => void;
};

/**
 * Final gate before a listing becomes live for the first time.
 * Shown after validation / photo-order confirmation; does not persist anything itself.
 */
export function ConfirmBeforePublishingDialog({
  open,
  statusLabel,
  address,
  price,
  onGoBack,
  onConfirm,
}: ConfirmBeforePublishingDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onGoBack();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm before publishing</DialogTitle>
        </DialogHeader>

        <dl className="space-y-4 py-1">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-0.5 text-lg font-semibold text-foreground">{statusLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</dt>
            <dd className="mt-0.5 text-lg font-semibold leading-snug text-foreground">{address}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price</dt>
            <dd className="mt-0.5 text-lg font-semibold text-foreground">{price}</dd>
          </div>
        </dl>

        <p className="text-sm text-muted-foreground">
          Publishing will make this listing live and may send Hot Sheet alerts to matching agents.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onGoBack}>
            Go Back
          </Button>
          <Button type="button" onClick={onConfirm}>
            Confirm & Publish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
