import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  attachmentKindForFile,
  removeMessageAttachment,
  uploadMessageAttachment,
  type MessageAttachment,
} from "@/lib/messageAttachments";

/** ~2 lines at 13px / leading-snug; caps growth before internal scroll. */
const COMPOSER_MIN_HEIGHT_PX = 44;
const COMPOSER_MAX_HEIGHT_PX = 128;

interface PendingAttachment {
  localId: string;
  name: string;
  kind: "image" | "video";
  previewUrl: string;
  uploading: boolean;
  attachment: MessageAttachment | null;
}

interface MessageComposerProps {
  onSend: (body: string, attachments: MessageAttachment[]) => Promise<boolean>;
  sending: boolean;
  /**
   * `bottom` — sticky footer below the thread (border-top).
   * `top` — directly under the panel header on empty threads (border-bottom).
   */
  edge?: "top" | "bottom";
  /** Extra classes on the footer shell (e.g. embedded sheet bottom padding). */
  footerClassName?: string;
  /** Enables photo/video attachments; uploads are scoped to this conversation. */
  conversationId?: string | null;
  /** Uploader id — required by the storage path/RLS contract. */
  currentUserId?: string | null;
}

export function MessageComposer({
  onSend,
  sending,
  edge = "bottom",
  footerClassName,
  conversationId,
  currentUserId,
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachmentsEnabled = Boolean(conversationId && currentUserId);
  const uploading = pending.some((p) => p.uploading);
  const readyAttachments = pending
    .map((p) => p.attachment)
    .filter((a): a is MessageAttachment => a !== null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, COMPOSER_MIN_HEIGHT_PX), COMPOSER_MAX_HEIGHT_PX);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT_PX ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Revoke object URLs on unmount only (previews live as long as the row does).
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(
    () => () => {
      pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    },
    [],
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || !conversationId || !currentUserId) return;
    const list = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const file of list) {
      const kind = attachmentKindForFile(file);
      if (!kind) {
        toast.error(`${file.name} is not a photo or video.`);
        continue;
      }
      const localId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setPending((prev) => [
        ...prev,
        { localId, name: file.name, kind, previewUrl, uploading: true, attachment: null },
      ]);

      const result = await uploadMessageAttachment({ file, conversationId, userId: currentUserId });
      if (result.ok === true) {
        const uploaded = result.attachment;
        setPending((prev) =>
          prev.map((p) => (p.localId === localId ? { ...p, uploading: false, attachment: uploaded } : p)),
        );
      } else {
        toast.error(result.message);
        setPending((prev) => prev.filter((p) => p.localId !== localId));
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  const removePending = (localId: string) => {
    const target = pending.find((p) => p.localId === localId);
    setPending((prev) => prev.filter((p) => p.localId !== localId));
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
      if (target.attachment) void removeMessageAttachment(target.attachment.path);
    }
  };

  const handleSend = async () => {
    const trimmed = value.trim();
    if (uploading) return;
    if (!trimmed && readyAttachments.length === 0) return;
    const ok = await onSend(trimmed, readyAttachments);
    if (ok) {
      setValue("");
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const shell = cn(
    edge === "top"
      ? "flex-shrink-0 border-b border-neutral-200/90 bg-white px-3 py-2.5"
      : "flex-shrink-0 border-t border-neutral-200/90 bg-white px-3 py-2.5",
    footerClassName,
  );

  const canSend = (value.trim().length > 0 || readyAttachments.length > 0) && !uploading && !sending;

  return (
    <div className={shell}>
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((p) => (
            <div
              key={p.localId}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200 bg-zinc-50"
            >
              {p.kind === "image" ? (
                <img src={p.previewUrl} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <video src={p.previewUrl} className="h-full w-full object-cover" muted playsInline />
              )}
              {p.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-[11px] font-medium text-zinc-600">
                  Uploading…
                </div>
              )}
              <button
                type="button"
                onClick={() => removePending(p.localId)}
                aria-label={`Remove ${p.name}`}
                className="absolute right-1 top-1 rounded-full bg-zinc-900/70 p-0.5 text-white hover:bg-zinc-900"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex w-full items-end gap-2">
        {attachmentsEnabled && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Attach photo or video"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-9 shrink-0 rounded-full text-zinc-500 hover:text-zinc-800"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          aria-label="Message text"
          rows={2}
          style={{ minHeight: COMPOSER_MIN_HEIGHT_PX, maxHeight: COMPOSER_MAX_HEIGHT_PX }}
          className="flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-[13px] leading-snug text-zinc-900 shadow-none placeholder:text-zinc-400 transition-colors focus:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
        />
        <Button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          className="h-9 shrink-0 gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
        >
          {sending || uploading ? "…" : "Send"}
          <Send className="h-3.5 w-3.5 opacity-95" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
