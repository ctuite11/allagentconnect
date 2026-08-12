import { supabase } from "@/integrations/supabase/client";

export const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments";
/** 50 MB cap keeps phone video clips workable without abusing storage. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export interface MessageAttachment {
  path: string;
  kind: "image" | "video";
  mimeType: string;
  name: string;
  size: number;
}

/** Narrow unknown jsonb from the DB into a safe attachment list. */
export function parseMessageAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: MessageAttachment[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    const path = typeof a.path === "string" ? a.path : "";
    const kind = a.kind === "video" ? "video" : "image";
    if (!path) continue;
    out.push({
      path,
      kind,
      mimeType: typeof a.mimeType === "string" ? a.mimeType : "",
      name: typeof a.name === "string" ? a.name : "attachment",
      size: typeof a.size === "number" ? a.size : 0,
    });
  }
  return out;
}

export function attachmentKindForFile(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

function safeExtension(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  const cleaned = fromName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  if (cleaned) return cleaned;
  const fromType = file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") ?? "";
  return fromType || "bin";
}

/**
 * Uploads to `<conversationId>/<userId>/<uuid>.<ext>` — the exact shape the
 * storage RLS policies validate (folder 1 = conversation, folder 2 = uploader).
 */
export async function uploadMessageAttachment(params: {
  file: File;
  conversationId: string;
  userId: string;
}): Promise<{ ok: true; attachment: MessageAttachment } | { ok: false; message: string }> {
  const { file, conversationId, userId } = params;
  const kind = attachmentKindForFile(file);
  if (!kind) return { ok: false, message: "Only photos and videos can be attached." };
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, message: `${file.name} is larger than 50 MB.` };
  }

  const path = `${conversationId}/${userId}/${crypto.randomUUID()}.${safeExtension(file)}`;
  const { error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (error) return { ok: false, message: error.message || "Upload failed." };

  return {
    ok: true,
    attachment: { path, kind, mimeType: file.type || "", name: file.name, size: file.size },
  };
}

export async function removeMessageAttachment(path: string): Promise<void> {
  await supabase.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove([path]);
}

/** Private bucket — viewing requires a short-lived signed URL. */
export async function createAttachmentSignedUrls(
  paths: string[],
  expiresInSeconds = 60 * 60,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data, error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error || !data) return map;
  for (const row of data) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}
