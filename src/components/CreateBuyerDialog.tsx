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

      // 0. Block if this email already belongs to an AAC account (agent or buyer).
      const { data: alreadyRegistered, error: regCheckErr } = await supabase.rpc(
        "is_email_registered_with_aac" as any,
        { p_email: normalizedEmail }
      );
      if (regCheckErr) {
        failWithStep("check existing AAC account", regCheckErr);
      }
      if (alreadyRegistered === true) {
        toast.error(
          "This email is already registered with AAC. They already have an account — share your AAC profile link instead."
        );
        return;
      }

      // 1. Look up an existing CRM contact for this agent + email so we can
      //    reactivate instead of hitting the unique-constraint error.
      const { data: existing, error: existingErr } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, client_type")
        .eq("agent_id", user.id)
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (existingErr && existingErr.code !== "PGRST116") {
        failWithStep("lookup existing contact", existingErr);
      }

      if (existing) {
        // Look up the latest relationship for this contact so we can branch.
        const { data: rel } = await supabase
          .from("client_agent_relationships")
          .select("id, status, ended_at, client_id")
          .eq("agent_id", user.id)
          .eq("crm_client_id", existing.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const isActive = rel && !rel.ended_at && rel.status === "active";
        const isPending = rel && !rel.ended_at && rel.status === "pending";

        if (isActive) {
          toast.error("This buyer is already in My Buyers.");
          return;
        }
        if (isPending) {
          toast.error("This buyer already has a pending invite.");
          return;
        }

        // Ended / inactive / declined / no relationship → reactivate.
        const { error: reactErr } = await supabase.rpc(
          "agent_reactivate_buyer" as any,
          { p_crm_client_id: existing.id }
        );
        if (reactErr) failWithStep("reactivate existing buyer", reactErr);

        // Backfill phone if the existing record was missing one and the agent typed a new value.
        if (!existing.phone && phone.trim()) {
          await supabase
            .from("clients")
            .update({ phone: phone.trim() })
            .eq("id", existing.id);
        }

        toast.success("Buyer reactivated.");
        const reactivatedPayload: CreatedBuyerPayload = {
          id: existing.id,
          firstName: existing.first_name || firstName.trim(),
          lastName: existing.last_name || lastName.trim(),
          email: (existing.email || normalizedEmail).toLowerCase(),
        };
        resetForm();
        onOpenChange(false);
        onSuccess(reactivatedPayload);
        return;
      }

      // 2. No existing contact → original insert path
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
        failWithStep("insert clients", clientErr);
      }

      // 3. Insert client_agent_relationships
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
