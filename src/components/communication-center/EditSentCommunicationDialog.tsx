import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  commsDialogBody,
  commsDialogContent,
  commsDialogDescription,
  commsDialogHeaderPad,
  commsDialogTitle,
  commsFieldLabel,
  commsInput,
  commsMessageCard,
  commsOutlineButton,
  commsTextarea,
} from "@/components/communication-center/commsCenterFormStyles";
import {
  CommsAttachmentPicker,
  type PendingCommsAttachment,
} from "@/components/communication-center/CommsAttachmentPicker";
import { removeCommsAttachment } from "@/lib/commsAttachments";
import {
  fetchSentBroadcastAttachments,
  resendCommsBroadcast,
  saveCommsBroadcastEdit,
  type SentBroadcastListItem,
} from "@/lib/commsSent";
import {
  formatResendAudienceMessage,
  RESEND_PAUSED_MESSAGE,
  sentCategoryLabel,
} from "@/lib/commsSentFormat";

type Props = {
  open: boolean;
  broadcast: SentBroadcastListItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function EditSentCommunicationDialog({ open, broadcast, onOpenChange, onSaved }: Props) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<PendingCommsAttachment[]>([]);
  const [existingPaths, setExistingPaths] = useState<Set<string>>(new Set());
  const [sessionNewPaths, setSessionNewPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);
  const [resendOutcome, setResendOutcome] = useState<"sent" | "duplicate" | "paused" | null>(null);
  const closingRef = useRef(false);
  const resendTokenRef = useRef("");

  useEffect(() => {
    if (!open || !broadcast) return;
    let cancelled = false;
    setLoading(true);
    setSubject(broadcast.subject);
    setMessage(broadcast.message);
    setSessionNewPaths(new Set());
    setConfirmResend(false);
    setResendOutcome(null);
    resendTokenRef.current = crypto.randomUUID();
    void (async () => {
      const loaded = await fetchSentBroadcastAttachments(broadcast.id);
      if (cancelled) return;
      setAttachments(loaded);
      setExistingPaths(new Set(loaded.map((a) => a.path)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, broadcast]);

  const handleAttachmentsChange = (next: PendingCommsAttachment[]) => {
    setAttachments(next);
    setSessionNewPaths((prev) => {
      const merged = new Set(prev);
      next.forEach((a) => {
        if (!existingPaths.has(a.path)) merged.add(a.path);
      });
      return merged;
    });
  };

  const cleanupSessionUploads = (keep: Set<string>) => {
    sessionNewPaths.forEach((path) => {
      if (!keep.has(path)) void removeCommsAttachment(path);
    });
  };

  const handleClose = (opts?: { discardSession?: boolean }) => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (opts?.discardSession !== false) cleanupSessionUploads(new Set());
    setSessionNewPaths(new Set());
    setAttachments([]);
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) closingRef.current = false;
  }, [open]);

  const handleSave = async () => {
    if (!broadcast) return;
    setSaving(true);
    const result = await saveCommsBroadcastEdit({
      broadcastId: broadcast.id,
      subject,
      message,
      attachments,
    });
    setSaving(false);
    if (result.ok === false) {
      toast.error(result.message);
      return;
    }
    cleanupSessionUploads(new Set(attachments.map((a) => a.path)));
    toast.success("Changes saved.");
    handleClose({ discardSession: false });
    onSaved();
  };

  const handleResend = async () => {
    if (!broadcast || resendOutcome) return;
    setConfirmResend(false);
    setResending(true);
    const result = await resendCommsBroadcast({
      broadcastId: broadcast.id,
      resendToken: resendTokenRef.current,
      subject,
      message,
      attachments,
    });
    setResending(false);
    if (result.ok === false) {
      toast.error(result.message);
      return;
    }
    cleanupSessionUploads(new Set(attachments.map((a) => a.path)));
    onSaved();
    if (result.kind === "duplicate") {
      setResendOutcome("duplicate");
      toast.success("Already resent");
      return;
    }
    if (result.kind === "paused") {
      setResendOutcome("paused");
      toast.success(RESEND_PAUSED_MESSAGE);
      return;
    }
    setResendOutcome("sent");
    toast.success(formatResendAudienceMessage(result.recipientCount, result.droppedIneligible) ?? "Sent again");
  };

  const busy = saving || resending;
  const sendAgainDone = resendOutcome !== null;
  const sendAgainLabel =
    resendOutcome === "sent"
      ? "Sent again"
      : resendOutcome === "duplicate"
        ? "Already resent"
        : resending
          ? "Sending…"
          : "Send Again";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className={commsDialogContent}>
        <div className={commsDialogHeaderPad}>
          <DialogHeader>
            <DialogTitle className={commsDialogTitle}>Edit Communication</DialogTitle>
            <DialogDescription className={commsDialogDescription}>
              Update this {sentCategoryLabel(broadcast?.category ?? "")} post on AAC. Saving does not send another
              email.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className={commsDialogBody}>
          <div className={commsMessageCard}>
            <div className="space-y-2.5">
              <Label className={commsFieldLabel}>Subject *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={commsInput}
                maxLength={200}
                disabled={loading || busy}
              />
            </div>
            <div className="space-y-2.5">
              <Label className={commsFieldLabel}>Message *</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={commsTextarea}
                rows={8}
                disabled={loading || busy}
              />
            </div>
            <div className="space-y-2.5">
              <Label className={commsFieldLabel}>Photos or video</Label>
              <CommsAttachmentPicker
                attachments={attachments}
                onChange={handleAttachmentsChange}
                disabled={loading || busy}
                purgeOnRemove={false}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className={commsOutlineButton} onClick={() => handleClose()} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || loading || !subject.trim() || !message.trim()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmResend(true)}
              disabled={busy || loading || sendAgainDone || !subject.trim() || !message.trim()}
            >
              {sendAgainLabel}
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog
        open={confirmResend}
        onOpenChange={(next) => {
          if (!next && !resending) setConfirmResend(false);
        }}
      >
        <AlertDialogContent className="z-[70] sm:max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Send this Communication again?</AlertDialogTitle>
            <AlertDialogDescription>
              This emails the original audience again. The email subject will be “Updated message.”
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className={commsOutlineButton}
              disabled={resending}
              onClick={() => setConfirmResend(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={resending} onClick={() => void handleResend()}>
              {resending ? "Sending…" : "Send Again"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
