import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  const core = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `Aac-${core}!7`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

/**
 * Admin-only: set a non-expiring password directly on an agent's account.
 * Sends no email — the admin shares the password out of band.
 */
export function SetTempPasswordDialog({ open, onOpenChange, defaultEmail = "" }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(generatePassword());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setSaving(true);
    try {
      await invokeEdgeFunction("admin-set-user-password", { email: trimmed, password });
      setDone(true);
      toast.success("Password set — no email was sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setSaving(false);
    }
  };

  const message = `Hi,

Sorry for the trouble resetting your password — I set one for you directly so you can get in right away.

Sign in: https://allagentconnect.com/auth
Email: ${email.trim().toLowerCase()}
Password: ${password}

This password does not expire. Once you're in you can change it any time under Settings > Password.

Best,
Chris`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDone(false);
          setPassword(generatePassword());
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set temporary password</DialogTitle>
          <DialogDescription>
            Sets a non-expiring password directly on the account and confirms the email. No email is
            sent — copy the message below and send it yourself.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tempPwEmail">Agent email</Label>
            <Input
              id="tempPwEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              disabled={done}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tempPwValue">Password</Label>
            <div className="flex gap-2">
              <Input id="tempPwValue" value={password} readOnly className="font-mono" />
              {!done && (
                <Button variant="outline" type="button" onClick={() => setPassword(generatePassword())}>
                  Regenerate
                </Button>
              )}
            </div>
          </div>

          {done && (
            <div className="space-y-2">
              <Label htmlFor="tempPwMessage">Message to send</Label>
              <textarea
                id="tempPwMessage"
                readOnly
                value={message}
                rows={12}
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(message);
                  toast.success("Copied");
                }}
              >
                Copy message
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {done ? "Close" : "Cancel"}
          </Button>
          {!done && (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Setting…" : "Set password"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}