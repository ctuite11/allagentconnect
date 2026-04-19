import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Mail, ListPlus, ArrowRight } from "lucide-react";

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
  const [sending, setSending] = useState(false);

  if (!buyer) return null;
  const name = `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email;

  const handleInviteNow = async () => {
    setSending(true);
    try {
      await invokeEdgeFunction("send-buyer-workspace-invite", {
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        email: buyer.email,
      });
      toast.success(`Invite sent to ${name}.`);
      onClose();
    } catch (err: any) {
      console.error("[BuyerCreatedNextStep] invite error:", err);
      toast.error(err?.message || "Couldn't send invite. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleCreateHotSheet = () => {
    onCreateHotSheet(buyer);
    onClose();
  };

  return (
    <Dialog open={!!buyer} onOpenChange={(o) => { if (!o) onClose(); }}>
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
            disabled={sending}
            className="w-full inline-flex items-center justify-between gap-3 h-12 px-4 rounded-xl bg-zinc-900 text-white font-medium text-[14px] hover:bg-zinc-800 transition-colors disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2.5">
              <ListPlus className="w-4 h-4" />
              Send Invite with Hot Sheet
            </span>
            <ArrowRight className="w-4 h-4 opacity-80" />
          </button>

          {/* Secondary */}
          <button
            onClick={handleInviteNow}
            disabled={sending}
            className="w-full inline-flex items-center justify-between gap-3 h-12 px-4 rounded-xl bg-white border border-zinc-200 text-zinc-900 font-medium text-[14px] hover:bg-zinc-50 hover:border-zinc-300 transition-colors disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2.5">
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
              ) : (
                <Mail className="w-4 h-4 text-zinc-500" />
              )}
              Invite Client Now
            </span>
            <ArrowRight className="w-4 h-4 text-zinc-400" />
          </button>

          <div className="pt-1">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={sending}
              className="w-full text-slate-500 hover:text-slate-900 font-normal"
            >
              Do This Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
