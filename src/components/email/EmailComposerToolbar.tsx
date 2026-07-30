/**
 * Email composer toolbar.
 *
 * SECURITY: images inserted here are uploaded to the `email-attachments`
 * bucket, which is intentionally PUBLIC (email clients must fetch images
 * anonymously) and is served via `getPublicUrl()`. Only non-sensitive inline
 * email images belong here. Sensitive attachments must use the private
 * `email-attachments-private` bucket with signed/authenticated downloads.
 * See docs/security/storage-buckets-classification.md
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image as ImageIcon, Link2, Loader2 } from "lucide-react";

interface EmailComposerToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
  uploadFolder?: string;
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

export function EmailComposerToolbar({
  textareaRef,
  value,
  onChange,
  uploadFolder = "bulk",
}: EmailComposerToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const insertAtCursor = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      onChange(value + snippet);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be signed in to upload images.");
        return;
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${uploadFolder}/${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase
        .storage
        .from("email-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("email-attachments").getPublicUrl(path);
      const url = pub.publicUrl;
      insertAtCursor(
        `\n<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />\n`
      );
      toast.success("Image uploaded and inserted.");
    } catch (e: any) {
      console.error("[email-toolbar] upload error", e);
      toast.error(e?.message || "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleInsertLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      toast.error("Please enter a URL");
      return;
    }
    const text = linkText.trim() || url;
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    insertAtCursor(`<a href="${safeUrl}" target="_blank" rel="noopener">${text}</a>`);
    setLinkText("");
    setLinkUrl("");
    setLinkOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Link2 className="h-4 w-4 mr-2" />
            Insert link
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="link-text" className="text-xs">Link text</Label>
            <Input
              id="link-text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Click here"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="link-url" className="text-xs">URL</Label>
            <Input
              id="link-url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={handleInsertLink}>Insert</Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4 mr-2" />
        )}
        {uploading ? "Uploading..." : "Insert photo"}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <span className="text-xs text-muted-foreground ml-auto">
        PNG/JPG/WEBP up to 5 MB · HTML supported
      </span>
    </div>
  );
}