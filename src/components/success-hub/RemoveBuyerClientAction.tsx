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
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("removeBuyerClient auth error: no authenticated user");
      toast.error("Couldn't remove this buyer client. Please sign in and try again.");
      return false;
    }

    if (opts.agentId !== user.id) {
      console.error("removeBuyerClient agent mismatch:", {
        passedAgentId: opts.agentId,
        authUserId: user.id,
        buyerId: opts.buyerId,
      });
    }

    const { data, error } = await supabase.rpc("agent_end_client_relationship", {
      p_client_id: opts.buyerId,
    });

    if (error) {
      console.error("removeBuyerClient Supabase error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        status: (error as any).status,
        buyerId: opts.buyerId,
        agentId: user.id,
      });
      toast.error("Couldn't remove this buyer client. Please try again.");
      return false;
    }

    console.info("removeBuyerClient success:", {
      rowsAffected: data,
      buyerId: opts.buyerId,
      agentId: user.id,
    });
    toast.success("Buyer removed. Hot sheets and history cleared. They're still in Contacts.");
    return true;
  } catch (err) {
    console.error("removeBuyerClient unexpected error:", err);
    toast.error("Couldn't remove this buyer client. Please try again.");
    return false;
  }
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
            Remove {buyerName ? buyerName : "this buyer"}?
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
