import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CommsAttachment } from "@/lib/commsAttachments";
import { createCommsAttachmentSignedUrls, MAX_COMMS_ATTACHMENTS } from "@/lib/commsAttachments";
import { friendlyResendCommsError, friendlyUpdateCommsError } from "@/lib/commsSentFormat";

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

export type ResendCommsBroadcastResult =
  | { ok: true; kind: "sent"; recipientCount: number; droppedIneligible: number }
  | { ok: true; kind: "duplicate" }
  | { ok: true; kind: "paused" }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asNonNegInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

async function readInvokeRecord(
  data: unknown,
  error: { message?: string; context?: Response } | null,
): Promise<Record<string, unknown> | null> {
  if (isRecord(data)) return data;
  const response = error?.context instanceof Response ? error.context : null;
  if (!response) return null;
  try {
    const parsed: unknown = JSON.parse(await response.clone().text());
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function resendCommsBroadcast(input: {
  broadcastId: string;
  resendToken: string;
  subject: string;
  message: string;
  attachments: CommsAttachment[];
}): Promise<ResendCommsBroadcastResult> {
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!subject) return { ok: false, message: "Please enter a subject." };
  if (!message) return { ok: false, message: "Please enter a message." };
  if (!input.resendToken) return { ok: false, message: "Couldn't send this Communication again. Please try again." };
  if (input.attachments.length > MAX_COMMS_ATTACHMENTS) {
    return { ok: false, message: "You can attach up to 10 photos or videos." };
  }

  const { data, error } = await supabase.functions.invoke("resend-comms-broadcast", {
    body: {
      broadcast_id: input.broadcastId,
      resend_token: input.resendToken,
      subject,
      message,
      attachments: toRpcAttachments(input.attachments),
    },
  });

  const body = await readInvokeRecord(data, error);
  if (body?.duplicate_suppressed === true) return { ok: true, kind: "duplicate" };
  if (body?.paused === true) return { ok: true, kind: "paused" };
  if (body?.success === true) {
    return {
      ok: true,
      kind: "sent",
      recipientCount: asNonNegInt(body.recipient_count),
      droppedIneligible: asNonNegInt(body.dropped_ineligible),
    };
  }

  const raw =
    (typeof body?.error === "string" && body.error) ||
    error?.message ||
    "Couldn't send this Communication again. Please try again.";
  return { ok: false, message: friendlyResendCommsError(raw) };
}
