import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Crown } from "lucide-react";

/**
 * Admin-only tool: send the Founding Partner invitation to a single email
 * address as a 1:1 transactional-style send (bypasses the bulk pause gate).
 * Backed by the `send-founder-invite` Edge Function.
 */
export default function AdminFounderInvite() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const ok = await hasRole(user.id, "admin");
      setAllowed(ok);
      setAuthChecked(true);
    })();
  }, [navigate]);

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-founder-invite", {
        body: { recipientEmail: trimmed, recipientName: name.trim() },
      });
      if (error || !(data as any)?.success) {
        throw new Error((data as any)?.error || error?.message || "Send failed");
      }
      toast.success(`Founder invite queued for ${trimmed}`);
      setLastResult(`Queued for ${trimmed}`);
      setEmail("");
      setName("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
      setLastResult(`Error: ${e?.message || "Failed to send"}`);
    } finally {
      setSending(false);
    }
  };

  if (!authChecked) {
    return <div className="p-8 text-sm text-neutral-500">Loading…</div>;
  }
  if (!allowed) {
    return <div className="p-8 text-sm text-destructive">Admin access required.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-[#22C55E]" />
            <CardTitle>Send Founder Invite</CardTitle>
          </div>
          <CardDescription>
            Send the Founding Partner invitation to one recipient. Delivered 1:1, bypassing the bulk pause gate.
            Unsubscribe link and suppression checks still apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="founder-email">Recipient email</Label>
            <Input
              id="founder-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="founder-name">Recipient name (optional)</Label>
            <Input
              id="founder-name"
              placeholder="First Last"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={sending}
            />
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-neutral-500">
              Logged in <code>email_jobs</code> and trackable from Admin → Email Analytics.
            </p>
            <Button onClick={handleSend} disabled={sending || !email.trim()}>
              {sending ? "Sending…" : "Send Invite"}
            </Button>
          </div>
          {lastResult && (
            <p className="text-sm text-neutral-600 pt-2 border-t border-neutral-100">{lastResult}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}