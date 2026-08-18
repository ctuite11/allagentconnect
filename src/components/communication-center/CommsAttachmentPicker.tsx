import { useEffect, useRef, useState } from "react";
import { Paperclip, X, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_COMMS_ATTACHMENTS,
  commsAttachmentKindForFile,
  removeCommsAttachment,
  uploadCommsAttachment,
  type CommsAttachment,
} from "@/lib/commsAttachments";

export interface PendingCommsAttachment extends CommsAttachment {
  previewUrl: string;
}

interface Props {
  attachments: PendingCommsAttachment[];
  onChange: (next: PendingCommsAttachment[]) => void;
  disabled?: boolean;
  /** When false, removing a tile only updates local state (edit flow). Default true for compose. */
  purgeOnRemove?: boolean;
}

/**
 * Comms Center broadcast attachments. Deliberately separate from the
 * conversation-scoped Messages attachment picker — uploads go to the private
 * `comms-attachments` bucket under the sender's own folder.
 */
export function CommsAttachmentPicker({
  attachments,
  onChange,
  disabled,
  purgeOnRemove = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const previewsRef = useRef<string[]>([]);

  previewsRef.current = attachments.map((a) => a.previewUrl);
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in to attach files.");
      return;
    }

    let current = attachments;
    for (const file of files) {
      if (current.length >= MAX_COMMS_ATTACHMENTS) {
        toast.error(`You can attach up to ${MAX_COMMS_ATTACHMENTS} files.`);
        break;
      }
      if (!commsAttachmentKindForFile(file)) {
        toast.error(`${file.name} is not a photo or video.`);
        continue;
      }
      setUploadingCount((c) => c + 1);
      const res = await uploadCommsAttachment({ file, userId: user.id });
      setUploadingCount((c) => c - 1);
      if (res.ok === false) {
        toast.error(res.message);
        continue;
      }
      current = [...current, { ...res.attachment, previewUrl: URL.createObjectURL(file) }];
      onChange(current);
    }
  };

  const handleRemove = async (path: string) => {
    const target = attachments.find((a) => a.path === path);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(attachments.filter((a) => a.path !== path));
    if (purgeOnRemove) await removeCommsAttachment(path);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploadingCount > 0 || attachments.length >= MAX_COMMS_ATTACHMENTS}
          onClick={() => inputRef.current?.click()}
        >
          {uploadingCount > 0 ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4 mr-2" />
          )}
          {uploadingCount > 0 ? "Uploading…" : "Add photos or video"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Up to {MAX_COMMS_ATTACHMENTS} files · 50 MB each
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void handleFiles(files);
        }}
      />

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <li
              key={a.path}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
            >
              {a.kind === "image" ? (
                <img src={a.previewUrl} alt={a.name} className="h-full w-full object-cover" />
              ) : (
                <div className="relative h-full w-full">
                  <video src={a.previewUrl} className="h-full w-full object-cover" muted />
                  <Play className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => void handleRemove(a.path)}
                className="absolute right-1 top-1 rounded-full bg-neutral-900/70 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
