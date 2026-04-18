import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  BUYER_STATUS_CONFIG,
  type BuyerStatus,
} from "@/lib/buyerStatus";

/**
 * Manually editable lifecycle stages.
 * Excludes:
 *  - invite_pending → system-derived from missing agent_user_id
 *  - archived → record-management action, handled separately (Archive / Restore)
 */
const EDITABLE_STATUSES: Array<"active" | "inactive" | "closed"> = [
  "active",
  "inactive",
  "closed",
];

type EditableStatus = (typeof EDITABLE_STATUSES)[number];

interface UpdateStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyer: {
    id: string;
    agent_id?: string | null;
    agent_user_id?: string | null;
  } | null;
  /** Currently resolved buyer status (may be invite_pending). */
  currentStatus: BuyerStatus;
  onSuccess: () => void;
}

function statusToRelationshipFields(
  status: EditableStatus,
): { status: string; ended_at: string | null } {
  if (status === "active") return { status: "active", ended_at: null };
  return { status, ended_at: new Date().toISOString() };
}

export function UpdateStatusDialog({
  open,
  onOpenChange,
  buyer,
  currentStatus,
  onSuccess,
}: UpdateStatusDialogProps) {
  // Default the selector to a manual stage. invite_pending and archived are not editable here.
  const initial: EditableStatus =
    currentStatus === "active" || currentStatus === "inactive" || currentStatus === "closed"
      ? currentStatus
      : "active";

  const [status, setStatus] = useState<EditableStatus>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setStatus(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentStatus]);

  const handleSave = async () => {
    if (!buyer || !buyer.agent_id) return;
    setSaving(true);
    const fields = statusToRelationshipFields(status);
    const { error } = await supabase
      .from("client_agent_relationships")
      .update(fields)
      .eq("agent_id", buyer.agent_id)
      .or(`crm_client_id.eq.${buyer.id},client_id.eq.${buyer.id}`);

    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Failed to update status.");
      return;
    }
    toast.success("Status updated.");
    onOpenChange(false);
    onSuccess();
  };

  const isInvitePending = currentStatus === "invite_pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Status</DialogTitle>
          <DialogDescription>
            Set the relationship stage for this buyer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="update-status">Stage</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as EditableStatus)}
            >
              <SelectTrigger id="update-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {BUYER_STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isInvitePending && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This buyer hasn’t accepted their invite yet. They’ll appear as
              Invite Pending until they do, regardless of the stage you set.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
