import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

type TemplateKind = "plain" | "branded" | "personal-forward-invite";

/**
 * Admin-only ad-hoc email sender. Sends a single 1:1 email through the
 * standard `email_jobs` queue via the `admin-send-email` Edge Function.
 */
export default function AdminSendEmail() {
  const navigate = useNavigate();
  // The form paints immediately; authorization + sender identity resolve in
  // the background and gate the Send button (fail-closed).
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [senderLine, setSenderLine] = useState<string | null>(null);


  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [template, setTemplate] = useState<TemplateKind>("plain");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cached session — avoids a network round trip just to learn the user id.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        navigate("/auth");
        return;
      }
      const [isAdmin, profileResult] = await Promise.all([
        hasRole(user.id, "admin"),
        supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setAllowed(isAdmin);
      if (isAdmin) {
        const profile = profileResult.data;
        const name = [profile?.first_name, profile?.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        const email = (profile?.email || user.email || "").trim();
        setSenderLine(name && email ? `${name} <${email}>` : email || null);
      }
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);



  const isInvite = template === "personal-forward-invite";

  const handleSend = async () => {
    const trimmed = to.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (!isInvite && (!subject.trim() || !message.trim())) {
      toast.error("Subject and message are required");
      return;
    }
    setSending(true);
    setLastResult(null);
    try {
      await invokeEdgeFunction("admin-send-email", {
        to: trimmed,
        subject: subject.trim() || undefined,
        message: message.trim() || undefined,
        template,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        replyTo: replyTo.trim() || undefined,
      });
      toast.success(`Email sent successfully to ${trimmed}`);
      setLastResult(`Sent successfully to ${trimmed}`);
      if (!isInvite) setMessage("");
    } catch (e) {
      const msg = (e as Error)?.message || "Failed to send";
      toast.error(msg);
      setLastResult(`Error: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  if (authChecked && !allowed) {
    return <div className="p-8 text-sm text-destructive">Admin access required.</div>;
  }

  const identityReady = authChecked && allowed && Boolean(senderLine);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-3 -ml-2 text-neutral-600"
        onClick={() => navigate("/admin/approvals")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Admin
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#22C55E]" />
            <CardTitle>Send Email</CardTitle>
          </div>

          <CardDescription>
            Send a one-off email to a single recipient through the normal email queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>From</Label>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              {senderLine ?? "Resolving your sender identity…"}
            </div>
            <p className="text-xs text-neutral-500">
              Sent as you, not as the automated All Agent Connect sender.
            </p>
          </div>

          <div className="space-y-2">

            <Label htmlFor="admin-email-to">Recipient email</Label>
            <Input
              id="admin-email-to"
              type="email"
              placeholder="name@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <Select
              value={template}
              onValueChange={(v) => setTemplate(v as TemplateKind)}
              disabled={sending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">Plain personal note</SelectItem>
                <SelectItem value="branded">AAC branded template</SelectItem>
                <SelectItem value="personal-forward-invite">
                  Latest agent invite email
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-email-subject">
              Subject {isInvite && <span className="text-neutral-400">(optional)</span>}
            </Label>
            <Input
              id="admin-email-subject"
              placeholder={isInvite ? "You’re invited to join All Agent Connect" : "Subject line"}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          {!isInvite && (
            <>
              <div className="space-y-2">
                <Label htmlFor="admin-email-message">Message</Label>
                <Textarea
                  id="admin-email-message"
                  rows={10}
                  placeholder="Write your message. Blank lines create new paragraphs."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sending}
                />
              </div>
              {template === "branded" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email-cta-label">Button label (optional)</Label>
                    <Input
                      id="admin-email-cta-label"
                      placeholder="View details"
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      disabled={sending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email-cta-url">Button link (optional)</Label>
                    <Input
                      id="admin-email-cta-url"
                      placeholder="https://allagentconnect.com/…"
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      disabled={sending}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="admin-email-reply">Reply-to (optional)</Label>
            <Input
              id="admin-email-reply"
              type="email"
              placeholder="chris@allagentconnect.com"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-neutral-500">
              Logged in <code>email_jobs</code> and trackable from Admin → Email Analytics.
            </p>
            <Button onClick={handleSend} disabled={sending || !to.trim()}>
              {sending ? "Sending…" : "Send Email"}
            </Button>
          </div>

          {lastResult && (
            <p className="border-t border-neutral-100 pt-2 text-sm text-neutral-600">{lastResult}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
