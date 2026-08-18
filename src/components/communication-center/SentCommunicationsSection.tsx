import { useCallback, useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import {
  commsDialogBody,
  commsDialogContent,
  commsDialogDescription,
  commsDialogHeaderPad,
  commsDialogTitle,
  commsOutlineButton,
} from "@/components/communication-center/commsCenterFormStyles";
import { EditSentCommunicationDialog } from "@/components/communication-center/EditSentCommunicationDialog";
import {
  fetchMySentBroadcasts,
  fetchSentBroadcastAttachments,
  type SentBroadcastAttachment,
  type SentBroadcastListItem,
} from "@/lib/commsSent";
import {
  formatSentDateTime,
  previewSentMessage,
  sentCategoryLabel,
} from "@/lib/commsSentFormat";

function ViewSentDialog({
  open,
  item,
  onOpenChange,
  onEdit,
}: {
  open: boolean;
  item: SentBroadcastListItem | null;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const [attachments, setAttachments] = useState<SentBroadcastAttachment[]>([]);

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    void (async () => {
      const next = await fetchSentBroadcastAttachments(item.id);
      if (!cancelled) setAttachments(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, item]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={commsDialogContent}>
        <div className={commsDialogHeaderPad}>
          <DialogHeader>
            <DialogTitle className={commsDialogTitle}>{item.subject}</DialogTitle>
            <DialogDescription className={commsDialogDescription}>
              {sentCategoryLabel(item.category)} · Sent {formatSentDateTime(item.created_at)}
              {item.edit_count > 0 && item.edited_at
                ? ` · Edited · ${formatSentDateTime(item.edited_at)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className={commsDialogBody}>
          <p className="whitespace-pre-wrap text-sm text-neutral-800">{item.message}</p>
          {attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li key={a.path} className="h-24 w-24 overflow-hidden rounded-lg border border-neutral-200">
                  {a.kind === "image" ? (
                    <img src={a.previewUrl} alt={a.name} className="h-full w-full object-cover" />
                  ) : (
                    <video src={a.previewUrl} className="h-full w-full object-cover" controls />
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-neutral-500">
            Sent to {item.recipient_count} {item.recipient_count === 1 ? "agent" : "agents"}
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className={commsOutlineButton} onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" onClick={onEdit}>
              Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SentCommunicationsSection() {
  const [rows, setRows] = useState<SentBroadcastListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<SentBroadcastListItem | null>(null);
  const [editItem, setEditItem] = useState<SentBroadcastListItem | null>(null);

  const reload = useCallback(async () => {
    const { rows: next, error: err } = await fetchMySentBroadcasts();
    setError(err);
    setRows(next);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <section className="space-y-3" data-testid="sent-communications">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Sent</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
          Communications you sent. Edit a post to update it on AAC — this does not email anyone again.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {rows === null ? (
        <AacMonogramLoader message="Loading sent Communications…" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-8 text-center text-sm text-neutral-500">
          You haven&apos;t sent any Communications yet.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {rows.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {sentCategoryLabel(item.category)}
                </p>
                <p className="font-semibold text-neutral-900">{item.subject}</p>
                <p className="text-sm text-neutral-600">{previewSentMessage(item.message)}</p>
                <p className="text-xs text-neutral-400">
                  {formatSentDateTime(item.created_at)}
                  {" · "}
                  {item.recipient_count} {item.recipient_count === 1 ? "agent" : "agents"}
                  {item.attachment_count > 0 ? (
                    <>
                      {" · "}
                      <Paperclip className="inline h-3 w-3" aria-hidden /> {item.attachment_count}
                    </>
                  ) : null}
                  {item.edit_count > 0 && item.edited_at ? (
                    <>
                      {" · "}
                      <span>Edited · {formatSentDateTime(item.edited_at)}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setViewItem(item)}>
                  View
                </Button>
                <Button type="button" size="sm" onClick={() => setEditItem(item)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ViewSentDialog
        open={!!viewItem}
        item={viewItem}
        onOpenChange={(open) => {
          if (!open) setViewItem(null);
        }}
        onEdit={() => {
          if (!viewItem) return;
          setEditItem(viewItem);
          setViewItem(null);
        }}
      />

      <EditSentCommunicationDialog
        open={!!editItem}
        broadcast={editItem}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
        onSaved={() => void reload()}
      />
    </section>
  );
}
