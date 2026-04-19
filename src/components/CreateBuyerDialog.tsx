import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CreatedBuyerPayload {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CreateBuyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Fired after both clients + relationship inserts succeed. Used to open the next-step modal. */
  onCreated?: (buyer: CreatedBuyerPayload) => void;
}

export function CreateBuyerDialog({ open, onOpenChange, onSuccess, onCreated }: CreateBuyerDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
  };

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("First name, last name, and email are required.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in.");
        return;
      }

      // 1. Insert into clients
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({
          agent_id: user.id,
          agent_user_id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          client_type: "buyer",
          source: "manual",
        })
        .select("id")
        .single();

      if (clientErr) throw clientErr;
      console.log("[CreateBuyer] created clients row:", client);

      // 2. Insert client_agent_relationships
      // NOTE: client_id refs auth.users(id) — leave null until buyer accepts invite.
      // crm_client_id refs clients(id) — the CRM contact bridge.
      const relPayload = {
        agent_id: user.id,
        crm_client_id: client.id,
        status: "pending" as const,
      };
      console.log("[CreateBuyer] relationship insert payload:", relPayload);

      const { error: relErr } = await supabase
        .from("client_agent_relationships")
        .insert(relPayload);

      if (relErr) throw relErr;

      toast.success("Buyer created successfully.");
      const createdPayload: CreatedBuyerPayload = {
        id: client.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      };
      resetForm();
      onOpenChange(false);
      onSuccess();
      onCreated?.(createdPayload);
    } catch (err: any) {
      console.error("Error creating buyer:", {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        raw: err,
      });
      toast.error(err?.message || "Failed to create buyer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Buyer</DialogTitle>
          <DialogDescription>
            Create a new buyer profile. They will also appear in your Contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="buyer-first">First Name *</Label>
              <Input
                id="buyer-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyer-last">Last Name *</Label>
              <Input
                id="buyer-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-email">Email *</Label>
            <Input
              id="buyer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-phone">Phone (optional)</Label>
            <FormattedInput
              id="buyer-phone"
              type="tel"
              format="phone"
              value={phone}
              onChange={(val) => setPhone(val)}
              placeholder="(555) 555-5555"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Buyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
