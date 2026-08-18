import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CommsAttachment } from "@/lib/commsAttachments";
import { createCommsAttachmentSignedUrls, MAX_COMMS_ATTACHMENTS } from "@/lib/commsAttachments";
import { friendlyUpdateCommsError } from "@/lib/commsSentFormat";

type BroadcastRow = Database["public"]["Tables"]["comms_broadcasts"]["Row"];
type AttachmentRow = Database["public"]["Tables"]["comms_broadcast_attachments"]["Row"];

export type SentBroadcastListItem = {
  id: string;
  category: string;
  subject: string;
  message: string;
  recipient_count: number;
  created_at: string;
  edit_count: number;
  edited_at: string | null;
  attachment_count: number;
};

export type SentBroadcastAttachment = CommsAttachment & {
  previewUrl: string;
};

export async function fetchMySentBroadcasts(): Promise<{
  rows: SentBroadcastListItem[];
  error: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], error: "Please sign in again." };

  const { data, error } = await supabase
    .from("comms_broadcasts")
    .select("id, category, subject, message, recipient_count, created_at, edit_count, edited_at")
    .eq("sender_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { rows: [], error: "Couldn't load your sent Communications." };

  const broadcasts = (data ?? []) as Pick<
    BroadcastRow,
    | "id"
    | "category"
    | "subject"
    | "message"
    | "recipient_count"
    | "created_at"
    | "edit_count"
    | "edited_at"
  >[];
  const ids = broadcasts.map((b) => b.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: atts } = await supabase
      .from("comms_broadcast_attachments")
      .select("broadcast_id")
      .in("broadcast_id", ids);
    (atts ?? []).forEach((a: { broadcast_id: string }) => {
      counts.set(a.broadcast_id, (counts.get(a.broadcast_id) ?? 0) + 1);
    });
  }

  return {
    rows: broadcasts.map((b) => ({
      id: b.id,
      category: b.category,
      subject: b.subject,
      message: b.message,
      recipient_count: b.recipient_count,
      created_at: b.created_at,
      edit_count: b.edit_count,
      edited_at: b.edited_at,
      attachment_count: counts.get(b.id) ?? 0,
    })),
    error: null,
  };
}

export async function fetchSentBroadcastAttachments(
  broadcastId: string,
): Promise<SentBroadcastAttachment[]> {
  const { data, error } = await supabase
    .from("comms_broadcast_attachments")
    .select("path, kind, mime_type, file_name, size_bytes, sort_order")
    .eq("broadcast_id", broadcastId)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) return [];
  const rows = data as Pick<
    AttachmentRow,
    "path" | "kind" | "mime_type" | "file_name" | "size_bytes" | "sort_order"
  >[];
  const signed = await createCommsAttachmentSignedUrls(rows.map((r) => r.path));
  return rows.map((r) => ({
    path: r.path,
    kind: r.kind === "video" ? "video" : "image",
    mimeType: r.mime_type ?? "",
    name: r.file_name || "attachment",
    size: r.size_bytes ?? 0,
    previewUrl: signed.get(r.path) ?? "",
  }));
}

export function toRpcAttachments(attachments: CommsAttachment[]): Record<string, string | number | null>[] {
  return attachments.map(({ path, kind, mimeType, name, size }) => ({
    path,
    kind,
    mimeType,
    name,
    size,
  }));
}

export async function saveCommsBroadcastEdit(input: {
  broadcastId: string;
  subject: string;
  message: string;
  attachments: CommsAttachment[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!subject) return { ok: false, message: "Please enter a subject." };
  if (!message) return { ok: false, message: "Please enter a message." };
  if (input.attachments.length > MAX_COMMS_ATTACHMENTS) {
    return { ok: false, message: "You can attach up to 10 photos or videos." };
  }

  const { error } = await supabase.rpc("update_comms_broadcast", {
    _broadcast_id: input.broadcastId,
    _subject: subject,
    _message: message,
    _attachments: toRpcAttachments(input.attachments),
  });

  if (error) return { ok: false, message: friendlyUpdateCommsError(error.message) };
  return { ok: true };
}
