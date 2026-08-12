import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createAttachmentSignedUrls,
  type MessageAttachment,
} from "@/lib/messageAttachments";

interface MessageAttachmentsProps {
  attachments: MessageAttachment[];
  isOwn: boolean;
}

export function MessageAttachments({ attachments, isOwn }: MessageAttachmentsProps) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [lightbox, setLightbox] = useState<string | null>(null);

  const key = attachments.map((a) => a.path).join("|");

  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setUrls(new Map());
      return;
    }
    createAttachmentSignedUrls(key.split("|")).then((map) => {
      if (!cancelled) setUrls(map);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (attachments.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          "grid gap-1.5",
          attachments.length > 1 ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        {attachments.map((a) => {
          const url = urls.get(a.path);
          if (!url) {
            return (
              <div
                key={a.path}
                className="h-32 w-full animate-pulse rounded-xl bg-zinc-200/70"
                aria-label={`Loading ${a.name}`}
              />
            );
          }
          if (a.kind === "video") {
            return (
              <video
                key={a.path}
                src={url}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-xl bg-black"
              />
            );
          }
          return (
            <button
              key={a.path}
              type="button"
              onClick={() => setLightbox(url)}
              className="overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <img
                src={url}
                alt={a.name}
                loading="lazy"
                className="h-full max-h-64 w-full object-cover"
              />
            </button>
          );
        })}
      </div>

      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          {lightbox && (
            <img src={lightbox} alt="Attachment" className="max-h-[80vh] w-full rounded-xl object-contain" />
          )}
        </DialogContent>
      </Dialog>
      <span className={cn("sr-only", isOwn && "sr-only")}>{attachments.length} attachment(s)</span>
    </>
  );
}
