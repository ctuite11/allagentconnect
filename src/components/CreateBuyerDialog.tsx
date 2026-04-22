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
  onSuccess: (created?: CreatedBuyerPayload) => void;
}

export function CreateBuyerDialog({ open, onOpenChange, onSuccess }: CreateBuyerDialogProps) {
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
      const failWithStep = (step: string, error: any): never => {
        console.error(`[CreateBuyerDialog] ${step} failed`, {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          raw: error,
        });
        throw new Error(error?.message || `${step} failed`);
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in.");
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      // 1. Insert into clients
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({
          agent_id: user.id,
          agent_user_id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: normalizedEmail,
          phone: phone.trim() || null,
          client_type: "buyer",
          source: "manual",
        })
        .select("id")
        .single();

      if (clientErr) {
        // Friendly handling for duplicate email under same agent
        if (
          clientErr.code === "23505" ||
          /clients_agent_email_unique/i.test(clientErr.message || "")
        ) {
          const { data: existing } = await supabase
            .from("clients")
            .select("id, first_name, last_name, email, client_type")
            .eq("agent_id", user.id)
            .ilike("email", normalizedEmail)
            .maybeSingle();

          const name = existing
            ? `${existing.first_name ?? ""} ${existing.last_name ?? ""}`.trim() || normalizedEmail
            : normalizedEmail;
          toast.error(`A contact with this email already exists (${name}). Open Contacts to edit it.`);
          return;
        }
        failWithStep("insert clients", clientErr);
      }

      // 2. Insert client_agent_relationships
      const { error: relErr } = await supabase
        .from("client_agent_relationships")
        .insert({
          agent_id: user.id,
          client_id: null,
          status: "pending",
          crm_client_id: client.id,
        } as any);

      if (relErr) failWithStep("insert client_agent_relationships", relErr);

      toast.success("Buyer created successfully.");
      const createdPayload: CreatedBuyerPayload = {
        id: client.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      };
      resetForm();
      onOpenChange(false);
      onSuccess(createdPayload);
    } catch (err: any) {
      console.error("Error creating buyer:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        raw: err,
      });
      toast.error(err?.message || "Can't add buyer. Try again.");
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
              inputMode="numeric"
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
