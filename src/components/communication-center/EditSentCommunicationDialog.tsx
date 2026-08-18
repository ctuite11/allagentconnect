import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  saveCommsBroadcastEdit,
  type SentBroadcastListItem,
} from "@/lib/commsSent";
import { sentCategoryLabel } from "@/lib/commsSentFormat";

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
  const closingRef = useRef(false);

  useEffect(() => {
    if (!open || !broadcast) return;
    let cancelled = false;
    setLoading(true);
    setSubject(broadcast.subject);
    setMessage(broadcast.message);
    setSessionNewPaths(new Set());
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
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2.5">
              <Label className={commsFieldLabel}>Message *</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={commsTextarea}
                rows={8}
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2.5">
              <Label className={commsFieldLabel}>Photos or video</Label>
              <CommsAttachmentPicker
                attachments={attachments}
                onChange={handleAttachmentsChange}
                disabled={loading || saving}
                purgeOnRemove={false}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className={commsOutlineButton} onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading || !subject.trim() || !message.trim()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
