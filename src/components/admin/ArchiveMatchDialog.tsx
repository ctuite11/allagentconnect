import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ArchiveMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: {
    id: string;
    archived_at: string | null;
    submission?: {
      address: string;
    };
  } | null;
  onSuccess: () => void;
}

export function ArchiveMatchDialog({
  open,
  onOpenChange,
  match,
  onSuccess,
}: ArchiveMatchDialogProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const isArchived = !!match?.archived_at;

  async function handleConfirm() {
    if (!match) return;

    setSaving(true);

    const { error } = await supabase
      .from("seller_matches")
      .update(
        isArchived
          ? { archived_at: null, archived_reason: null }
          : { archived_at: new Date().toISOString(), archived_reason: reason.trim() || null }
      )
      .eq("id", match.id);

    setSaving(false);

    if (error) {
      console.error("Error updating archive status:", error);
      toast.error(`Failed to ${isArchived ? "unarchive" : "archive"} match`);
      return;
    }

    toast.success(isArchived ? "Match restored" : "Match archived");
    setReason("");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchived ? "Restore Match" : "Archive Match"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived
              ? `Restore "${match?.submission?.address}" to active matches?`
              : `Archive "${match?.submission?.address}"? It will be hidden from the main list but can be restored later.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isArchived && (
          <div className="space-y-2 py-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this match being archived?"
              maxLength={300}
              rows={2}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isArchived ? "Restore" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
