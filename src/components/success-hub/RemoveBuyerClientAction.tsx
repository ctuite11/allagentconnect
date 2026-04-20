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

    // CRM-first lookup (buyerId in this dialog is CRM client id).
    let relationshipRow: { id: string } | null = null;

    const { data: crmRel, error: crmRelError } = await supabase
      .from("client_agent_relationships")
      .select("id")
      .eq("agent_id", user.id)
      .eq("crm_client_id", opts.buyerId)
      .in("status", ["active", "pending"])
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (crmRelError) {
      console.error("removeBuyerClient CRM relationship lookup error:", {
        code: crmRelError.code,
        message: crmRelError.message,
        details: crmRelError.details,
        hint: crmRelError.hint,
      });
    }

    relationshipRow = crmRel || null;

    // Fallback: if caller passed an auth user id, handle that too.
    if (!relationshipRow) {
      const { data: authRel, error: authRelError } = await supabase
        .from("client_agent_relationships")
        .select("id")
        .eq("agent_id", user.id)
        .eq("client_id", opts.buyerId)
        .in("status", ["active", "pending"])
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (authRelError) {
        console.error("removeBuyerClient auth relationship lookup error:", {
          code: authRelError.code,
          message: authRelError.message,
          details: authRelError.details,
          hint: authRelError.hint,
        });
      }

      relationshipRow = authRel || null;
    }

    if (!relationshipRow?.id) {
      throw new Error("No active or pending relationship row found for this buyer");
    }

    const { data, error } = await (supabase as any).rpc("agent_end_client_relationship_by_id", {
      p_relationship_id: relationshipRow.id,
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
      relationshipId: relationshipRow.id,
      buyerId: opts.buyerId,
      agentId: user.id,
    });
    toast.success("Removed from buyer clients. They're still in Contacts.");
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
