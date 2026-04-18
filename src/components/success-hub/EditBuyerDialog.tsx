import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
  } | null;
  onSuccess: () => void;
}

/**
 * Edit Buyer = profile/contact info only.
 * Relationship stage (Active/Inactive/Closed/Archived) is managed via
 * UpdateStatusDialog. Invite Pending is system-derived and never editable here.
 */
export function EditBuyerDialog({
  open,
  onOpenChange,
  buyer,
  onSuccess,
}: EditBuyerDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!buyer || !open) return;
    setFirstName(buyer.first_name || "");
    setLastName(buyer.last_name || "");
    setEmail(buyer.email || "");
    setPhone(buyer.phone || "");
    setNotes((buyer as any).notes || "");
  }, [buyer, open]);

  const handleSave = async () => {
    if (!buyer) return;
    if (!firstName.trim() || !email.trim()) {
      toast.error("First name and email are required.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      .eq("id", buyer.id);

    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Failed to update buyer.");
      return;
    }

    toast.success("Buyer updated.");
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Buyer</DialogTitle>
          <DialogDescription>Update contact information for this buyer.</DialogDescription>
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
