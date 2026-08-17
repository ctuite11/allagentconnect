import { supabase } from "@/integrations/supabase/client";

export const COMMS_ATTACHMENTS_BUCKET = "comms-attachments";
/** Same 50 MB ceiling as Messages attachments. */
export const MAX_COMMS_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const MAX_COMMS_ATTACHMENTS = 10;

export interface CommsAttachment {
  path: string;
  kind: "image" | "video";
  mimeType: string;
  name: string;
  size: number;
}

export function commsAttachmentKindForFile(file: File): "image" | "video" | null {
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

/** Human summary used by the email CTA and feed labels. */
export function summarizeCommsAttachments(attachments: Array<{ kind: "image" | "video" }>): string {
  const photos = attachments.filter((a) => a.kind === "image").length;
  const videos = attachments.filter((a) => a.kind === "video").length;
  const parts: string[] = [];
  if (photos) parts.push(`${photos} photo${photos === 1 ? "" : "s"}`);
  if (videos) parts.push(`${videos} video${videos === 1 ? "" : "s"}`);
  return parts.join(" and ");
}

/**
 * Uploads to `<userId>/<uuid>.<ext>` — the exact shape the comms-attachments
 * storage policies validate (folder 1 = uploader). This is intentionally a
 * different contract from the conversation-scoped `message-attachments` bucket.
 */
export async function uploadCommsAttachment(params: {
  file: File;
  userId: string;
}): Promise<{ ok: true; attachment: CommsAttachment } | { ok: false; message: string }> {
  const { file, userId } = params;
  const kind = commsAttachmentKindForFile(file);
  if (!kind) return { ok: false, message: "Only photos and videos can be attached." };
  if (file.size > MAX_COMMS_ATTACHMENT_BYTES) {
    return { ok: false, message: `${file.name} is larger than 50 MB.` };
  }

  const path = `${userId}/${crypto.randomUUID()}.${safeExtension(file)}`;
  const { error } = await supabase.storage
    .from(COMMS_ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (error) return { ok: false, message: error.message || "Upload failed." };

  return {
    ok: true,
    attachment: { path, kind, mimeType: file.type || "", name: file.name, size: file.size },
  };
}

export async function removeCommsAttachment(path: string): Promise<void> {
  await supabase.storage.from(COMMS_ATTACHMENTS_BUCKET).remove([path]);
}

/** Private bucket — viewing requires a short-lived signed URL. */
export async function createCommsAttachmentSignedUrls(
  paths: string[],
  expiresInSeconds = 60 * 60,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data, error } = await supabase.storage
    .from(COMMS_ATTACHMENTS_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error || !data) return map;
  for (const row of data) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}
