import { useMemo, useState } from "react";
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

export interface TempPasswordAgentOption {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
  /** Admin agent list used for the email typeahead. */
  agents?: TempPasswordAgentOption[];
}

/**
 * Admin-only: set a non-expiring password directly on an agent's account.
 * Sends no email — the admin shares the password out of band.
 */
export function SetTempPasswordDialog({ open, onOpenChange, defaultEmail = "", agents = [] }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(generatePassword());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const suggestions = useMemo(() => {
    const q = email.trim().toLowerCase();
    const withEmail = agents.filter((a) => a.email);
    const scored = q
      ? withEmail.filter((a) => {
          const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.toLowerCase();
          return a.email.toLowerCase().includes(q) || name.includes(q);
        })
      : withEmail;
    return scored.slice(0, 8);
  }, [agents, email]);

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

  const handleSendEmail = async () => {
    const trimmed = email.trim().toLowerCase();
    setSending(true);
    try {
      await invokeEdgeFunction("send-temp-password-email", { email: trimmed, password });
      setSent(true);
      toast.success("Email queued to the agent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
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
          setSent(false);
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
            <div className="relative">
              <Input
                id="tempPwEmail"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
                placeholder="Search agents or type an email"
                autoComplete="off"
                disabled={done}
              />
              {!done && showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                  {suggestions.map((a) => {
                    const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setEmail(a.email);
                            setShowSuggestions(false);
                          }}
                        >
                          <span className="block truncate font-medium">{name || a.email}</span>
                          {name && (
                            <span className="block truncate text-xs text-muted-foreground">{a.email}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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
              <div className="flex flex-wrap gap-2">
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
                <Button
                  size="sm"
                  type="button"
                  onClick={handleSendEmail}
                  disabled={sending || sent}
                >
                  {sent ? "Email sent" : sending ? "Sending…" : "Email it to the agent"}
                </Button>
              </div>
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