import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Mail, ListPlus, ArrowRight } from "lucide-react";
import { ReviewBuyerInviteDialog } from "./ReviewBuyerInviteDialog";

export interface CreatedBuyer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface BuyerCreatedNextStepDialogProps {
  buyer: CreatedBuyer | null;
  onClose: () => void;
  onCreateHotSheet: (buyer: CreatedBuyer) => void;
}

export function BuyerCreatedNextStepDialog({
  buyer,
  onClose,
  onCreateHotSheet,
}: BuyerCreatedNextStepDialogProps) {
  const [reviewBuyer, setReviewBuyer] = useState<CreatedBuyer | null>(null);

  if (!buyer && !reviewBuyer) return null;

  const activeBuyer = buyer;
  const name = activeBuyer
    ? `${activeBuyer.firstName} ${activeBuyer.lastName}`.trim() || activeBuyer.email
    : "";

  const handleInviteNow = () => {
    if (!activeBuyer) return;
    setReviewBuyer(activeBuyer);
  };

  const handleCreateHotSheet = () => {
    if (!activeBuyer) return;
    onCreateHotSheet(activeBuyer);
    onClose();
  };

  const handleReviewClose = () => {
    setReviewBuyer(null);
    // After the review modal closes (sent or cancelled), also close the
    // outer "Buyer Added" modal so the agent isn't dropped back into it.
    onClose();
  };

  return (
    <>
      <Dialog
        open={!!activeBuyer && !reviewBuyer}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-lg">Buyer Added</DialogTitle>
            <DialogDescription>
              {name} has been added to My Buyers. What would you like to do next?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            {/* Primary — best next action */}
            <button
              onClick={handleCreateHotSheet}
              className="w-full inline-flex items-center justify-between gap-3 h-12 px-4 rounded-xl bg-[#0E56F5] text-white font-medium text-[14px] hover:bg-[#0B47CC] transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                <ListPlus className="w-4 h-4" />
                Send Invite with Hot Sheet
              </span>
              <ArrowRight className="w-4 h-4 opacity-80" />
            </button>

            {/* Secondary — opens reviewable invite draft */}
            <button
              onClick={handleInviteNow}
              className="w-full inline-flex items-center justify-between gap-3 h-12 px-4 rounded-xl bg-white border border-zinc-200 text-zinc-900 font-medium text-[14px] hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-zinc-500" />
                Invite Client Now
              </span>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
            </button>

            <div className="pt-1">
              <Button
                variant="ghost"
                onClick={onClose}
                className="w-full text-slate-500 hover:text-slate-900 font-normal"
              >
                Do This Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReviewBuyerInviteDialog
        buyer={reviewBuyer}
        onClose={handleReviewClose}
      />
    </>
  );
}
