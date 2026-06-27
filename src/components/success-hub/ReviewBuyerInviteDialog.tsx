import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { enqueueBuyerWorkspaceInvite } from "@/lib/enqueueBuyerWorkspaceInvite";
import { showInviteEmailSentToast } from "@/lib/inviteEmailSentFeedback";
import { toast } from "sonner";
import { Loader2, Mail, ArrowRight } from "lucide-react";

export interface ReviewInviteBuyer {
  /** CRM clients.id — required for the share_token payload */
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ReviewBuyerInviteDialogProps {
  buyer: ReviewInviteBuyer | null;
  onClose: () => void;
  onSent?: () => void;
  /**
   * Which flow opened this dialog. Controls the primary CTA label.
   * - "invite-only" (default): standard workspace invite, no hot sheet attached.
   * - "with-hot-sheet": invite is paired with a hot sheet send.
   */
  variant?: "invite-only" | "with-hot-sheet";
}

const DEFAULT_SUBJECT =
  "You've been invited to view listings on All Agent Connect";

const buildDefaultBody = (firstName: string, agentName: string) =>
  `Hi ${firstName || "there"},

I've added you to All Agent Connect so I can share listings, Hot Sheets, and updates with you directly.

Use the button in this email to join and access your private buyer workspace.

Thanks,
${agentName || "Your agent"}
hello@allagentconnect.com`;

export function ReviewBuyerInviteDialog({
  buyer,
  onClose,
  onSent,
  variant = "invite-only",
}: ReviewBuyerInviteDialogProps) {
  const [agentName, setAgentName] = useState("Your agent");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Load the current agent's name so the body preview reflects the real signature
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      const { data: ap } = await (supabase as any)
        .from("agent_profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();

      let name = [ap?.first_name, ap?.last_name].filter(Boolean).join(" ").trim();
      if (!name) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();
        name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
      }
      if (!name) name = "Your agent";

      if (!cancelled) setAgentName(name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-seed the editable draft whenever the buyer or agent name changes
  useEffect(() => {
    if (!buyer) return;
    setSubject(DEFAULT_SUBJECT);
    setBody(buildDefaultBody(buyer.firstName, agentName));
  }, [buyer, agentName]);

  if (!buyer) return null;

  const fullName = `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required.");
      return;
    }

    setSending(true);
    try {
      // 1) Auth context — the agent must be signed in
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("Your session has expired. Please sign in again.");

      const enqueueRes = await enqueueBuyerWorkspaceInvite({
        supabase,
        agentUserId: user.id,
        buyer: {
          id: buyer.id,
          email: buyer.email,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
        },
        inviterDisplayName: agentName,
      });

      if (!enqueueRes.ok) {
        console.error("[ReviewBuyerInvite] enqueueBuyerWorkspaceInvite failed", {
          error: enqueueRes.error,
          buyerId: buyer.id,
        });
        toast.warning(
          `Invite was not queued: ${enqueueRes.error ?? "Unknown error"}. Try again or contact support.`,
        );
        return;
      }

      void supabase.functions.invoke("kick-email-queue").catch((e) => {
        console.warn(
          "[ReviewBuyerInvite] kick-email-queue invoke failed (email may still process on schedule)",
          e,
        );
      });

      showInviteEmailSentToast();
      onSent?.();
      onClose();
    } catch (err: any) {
      console.error("[ReviewBuyerInvite] send failed:", err);
      toast.error(
        "Couldn't send the invite. Please try again or contact support if this continues.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={!!buyer}
      onOpenChange={(o) => {
        if (!o && !sending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Review Buyer Invitation</DialogTitle>
          <DialogDescription>
            Confirm the details below before sending the invite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Recipient summary */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white border border-zinc-200">
                <Mail className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-zinc-900 truncate">
                  {fullName}
                </div>
                <div className="text-[13px] text-zinc-500 truncate">
                  {buyer.email}
                </div>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="invite_subject">Subject</Label>
            <Input
              id="invite_subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-11"
              disabled={sending}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="invite_body">Message</Label>
            <Textarea
              id="invite_body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-none font-normal text-[14px] leading-relaxed"
              disabled={sending}
            />
            <p className="text-[12px] text-zinc-500">
              The outgoing email uses the standard invite template with a secure join button. Subject and
              message here are for your review only.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={sending}
              className="h-11 px-5"
            >
              Cancel
            </Button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0E56F5] text-white font-medium text-[14px] hover:bg-[#0B47CC] transition-colors disabled:opacity-60"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  {variant === "with-hot-sheet" ? "Send Hot Sheet with Invite" : "Send Invite"}
                  <ArrowRight className="w-4 h-4 opacity-90" />
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
