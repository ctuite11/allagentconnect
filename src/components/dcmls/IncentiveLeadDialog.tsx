import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type IncentiveType = "buyer" | "seller";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100, "Name must be under 100 characters."),
  email: z.string().trim().email("Please enter a valid email.").max(255, "Email must be under 255 characters."),
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agentId: string;
  agentName: string;
  type: IncentiveType;
  zip?: string | null;
  listingId?: string | null;
}

/** Name + Email only. Never reveals incentive details; the request goes to the agent. */
export function IncentiveLeadDialog({ open, onOpenChange, agentId, agentName, type, zip, listingId }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const label = type === "buyer" ? "Buyer" : "Seller";

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setSent(false);
      setError(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse({ name, email });
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setError(null);
    setSending(true);
    const { data, error: fnErr } = await supabase.functions.invoke("dcmls-incentive-lead", {
      body: { agent_id: agentId, type, name: r.data.name, email: r.data.email, zip: zip ?? null, listing_id: listingId ?? null },
    });
    setSending(false);
    if (fnErr || !(data as { ok?: boolean })?.ok) {
      let msg = "We couldn't send your request. Please try again.";
      try {
        const body = await (fnErr as { context?: Response })?.context?.json?.();
        if (body?.error && typeof body.error === "string") msg = body.error;
      } catch { /* keep default */ }
      setError(msg);
      return;
    }
    setSent(true);
    setName("");
    setEmail("");
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Get {label} Incentive Details</DialogTitle>
          <DialogDescription>From {agentName}</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Thanks — your request was sent. {agentName} will contact you by email with the incentive details.
            </p>
            <Button className="w-full" onClick={() => close(false)}>Done</Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="incentive-lead-name">Name *</Label>
              <Input id="incentive-lead-name" autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="incentive-lead-email">Email *</Label>
              <Input id="incentive-lead-email" type="email" autoComplete="email" spellCheck={false} maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <p className="text-xs text-muted-foreground">
              Your contact information will be shared with this agent so they can provide the incentive details. No phone number required.
            </p>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? "Sending..." : "Send Me the Details"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
