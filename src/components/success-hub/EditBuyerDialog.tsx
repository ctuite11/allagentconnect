import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  BUYER_STATUS_ORDER,
  BUYER_STATUS_CONFIG,
  getBuyerStatus,
  type BuyerStatus,
} from "@/lib/buyerStatus";

interface EditBuyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    notes?: string | null;
    agent_id?: string | null;
    agent_user_id?: string | null;
  } | null;
  /** Optional: pre-resolved current status (skips a fetch) */
  initialStatus?: BuyerStatus;
  onSuccess: () => void;
}

/**
 * Map a target BuyerStatus → the relationship row mutation we should write.
 * Notes:
 *  - "active" requires the buyer to have accepted the invite (agent_user_id set).
 *    If not accepted, we treat it as "invite_pending" semantics — keep status='active'
 *    on relationship (which the unified getBuyerStatus reads as invite_pending until
 *    agent_user_id exists), and just clear ended_at.
 */
function statusToRelationshipFields(status: BuyerStatus): {
  status: string;
  ended_at: string | null;
} {
  switch (status) {
    case "active":
    case "invite_pending":
      return { status: "active", ended_at: null };
    case "inactive":
      return { status: "inactive", ended_at: new Date().toISOString() };
    case "closed":
      return { status: "closed", ended_at: new Date().toISOString() };
    case "archived":
      return { status: "archived", ended_at: new Date().toISOString() };
  }
}

export function EditBuyerDialog({
  open,
  onOpenChange,
  buyer,
  initialStatus,
  onSuccess,
}: EditBuyerDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<BuyerStatus>("invite_pending");
  const [originalStatus, setOriginalStatus] = useState<BuyerStatus>("invite_pending");
  const [saving, setSaving] = useState(false);

  // Hydrate fields when the dialog opens
  useEffect(() => {
    if (!buyer || !open) return;
    setFirstName(buyer.first_name || "");
    setLastName(buyer.last_name || "");
    setEmail(buyer.email || "");
    setPhone(buyer.phone || "");
    setNotes((buyer as any).notes || "");

    // Status: prefer caller-provided, otherwise fetch from relationship row
    if (initialStatus) {
      setStatus(initialStatus);
      setOriginalStatus(initialStatus);
      return;
    }

    let cancelled = false;
    (async () => {
      if (!buyer.agent_id) return;
      const { data: rel } = await supabase
        .from("client_agent_relationships")
        .select("status,ended_at")
        .eq("agent_id", buyer.agent_id)
        .or(`crm_client_id.eq.${buyer.id},client_id.eq.${buyer.id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const resolved = getBuyerStatus({
        agent_user_id: buyer.agent_user_id,
        relationship_status: rel?.status,
        relationship_ended_at: rel?.ended_at,
      });
      setStatus(resolved);
      setOriginalStatus(resolved);
    })();
    return () => { cancelled = true; };
  }, [buyer, open, initialStatus]);

  const handleSave = async () => {
    if (!buyer) return;
    if (!firstName.trim() || !email.trim()) {
      toast.error("First name and email are required.");
      return;
    }

    setSaving(true);

    // 1. Update CRM contact fields
    const { error: clientErr } = await supabase
      .from("clients")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      .eq("id", buyer.id);

    if (clientErr) {
      setSaving(false);
      toast.error("Failed to update buyer.");
      console.error(clientErr);
      return;
    }

    // 2. Update relationship status if it changed
    if (status !== originalStatus && buyer.agent_id) {
      const fields = statusToRelationshipFields(status);
      const { error: relErr } = await supabase
        .from("client_agent_relationships")
        .update(fields)
        .eq("agent_id", buyer.agent_id)
        .or(`crm_client_id.eq.${buyer.id},client_id.eq.${buyer.id}`);

      if (relErr) {
        setSaving(false);
        toast.error("Buyer saved, but status update failed.");
        console.error(relErr);
        return;
      }
    }

    setSaving(false);
    toast.success("Buyer updated.");
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Buyer</DialogTitle>
          <DialogDescription>Update contact information and status for this buyer.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-first">First Name</Label>
              <Input id="edit-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-last">Last Name</Label>
              <Input id="edit-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BuyerStatus)}>
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUYER_STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {BUYER_STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {status === "active" && !buyer?.agent_user_id && (
              <p className="text-[11px] text-muted-foreground">
                Will show as “Invite Pending” until the buyer accepts their invite.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
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
