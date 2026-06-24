import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import {
  REMOVE_BUYER_BUTTON_LABEL,
  REMOVE_BUYER_DIALOG_BODY,
  REMOVE_BUYER_DIALOG_TITLE,
  removeBuyer,
} from "@/lib/removeBuyer";

interface RemoveBuyerClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerId?: string | null;
  onRemoved?: () => void;
}

/**
 * Destructive confirm dialog used from My Buyers row + Buyer Account header.
 */
export function RemoveBuyerClientDialog({
  open,
  onOpenChange,
  buyerId,
  onRemoved,
}: RemoveBuyerClientDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (!buyerId) return;
    setBusy(true);
    const result = await removeBuyer({ scope: "agent", crmClientId: buyerId });
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      onRemoved?.();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{REMOVE_BUYER_DIALOG_TITLE}</AlertDialogTitle>
          <AlertDialogDescription>{REMOVE_BUYER_DIALOG_BODY}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {REMOVE_BUYER_BUTTON_LABEL}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
