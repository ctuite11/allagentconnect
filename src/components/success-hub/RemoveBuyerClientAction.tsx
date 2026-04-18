import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

/**
 * Ends the buyer-client relationship for this agent.
 * The contact record (clients row) is preserved — they remain in Contacts.
 */
export async function removeBuyerClient(opts: {
  agentId: string;
  buyerId: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from("client_agent_relationships")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("agent_id", opts.agentId)
    .or(`crm_client_id.eq.${opts.buyerId},client_id.eq.${opts.buyerId}`);
  if (error) {
    console.error(error);
    toast.error("Couldn't remove this buyer client. Please try again.");
    return false;
  }
  toast.success("Removed from buyer clients. They're still in Contacts.");
  return true;
}

interface RemoveBuyerClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerName?: string;
  agentId?: string | null;
  buyerId?: string | null;
  onRemoved?: () => void;
}

/**
 * Destructive confirm dialog used from My Buyers row + Buyer Account header.
 */
export function RemoveBuyerClientDialog({
  open,
  onOpenChange,
  buyerName,
  agentId,
  buyerId,
  onRemoved,
}: RemoveBuyerClientDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (!agentId || !buyerId) return;
    setBusy(true);
    const ok = await removeBuyerClient({ agentId, buyerId });
    setBusy(false);
    if (ok) {
      onOpenChange(false);
      onRemoved?.();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {buyerName ? `${buyerName} ` : ""}as a buyer client?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They'll be removed from My Buyers and your buyer workflows. Their
            contact info and history stay in Contacts — nothing is deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
