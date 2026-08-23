import { supabase } from "@/integrations/supabase/client";
import type { CommsChannelKey } from "@/lib/commsChannelPrefs";
import { createCommsAttachmentSignedUrls } from "@/lib/commsAttachments";

export type ChannelBroadcastItem = {
  id: string;
  category: CommsChannelKey;
  subject: string;
  message: string;
  recipient_count: number | null;
  created_at: string;
  edit_count?: number;
  edited_at?: string | null;
  attachment_count: number;
  sender: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
  } | null;
};

async function fetchAgentMap(ids: string[]) {
  const map = new Map<string, ChannelBroadcastItem["sender"]>();
  if (!ids.length) return map;
  const { data } = await supabase
    .from("agent_profiles")
    .select("id, first_name, last_name, email, phone, company")
    .in("id", ids);
  (data || []).forEach((a) => {
    map.set(a.id, {
      id: a.id,
      name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "AAC Agent",
      email: a.email ?? null,
      phone: a.phone ?? null,
      company: a.company ?? null,
    });
  });
  return map;
}

async function attachCounts(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!ids.length) return counts;
  const { data } = await supabase
    .from("comms_broadcast_attachments")
    .select("broadcast_id")
    .in("broadcast_id", ids);
  (data || []).forEach((a) => {
    counts.set(a.broadcast_id, (counts.get(a.broadcast_id) ?? 0) + 1);
  });
  return counts;
}

export async function fetchChannelReceivedBroadcasts(
  category: CommsChannelKey,
): Promise<{ rows: ChannelBroadcastItem[]; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], error: "Please sign in again." };

  const { data, error } = await supabase
    .from("comms_broadcasts")
    .select("id, category, subject, message, recipient_count, created_at, sender_id")
    .eq("category", category)
    .neq("sender_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { rows: [], error: "Couldn't load messages." };

  const broadcasts = data ?? [];
  const senderIds = Array.from(new Set(broadcasts.map((b) => b.sender_id).filter(Boolean))) as string[];
  const senders = await fetchAgentMap(senderIds);
  const counts = await attachCounts(broadcasts.map((b) => b.id));

  return {
    rows: broadcasts.map((b) => ({
      id: b.id,
      category: b.category as CommsChannelKey,
      subject: b.subject ?? "",
      message: b.message ?? "",
      recipient_count: b.recipient_count,
      created_at: b.created_at,
      attachment_count: counts.get(b.id) ?? 0,
      sender: b.sender_id ? senders.get(b.sender_id) ?? null : null,
    })),
    error: null,
  };
}

export async function fetchChannelSentBroadcasts(
  category: CommsChannelKey,
): Promise<{ rows: ChannelBroadcastItem[]; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], error: "Please sign in again." };

  const { data, error } = await supabase
    .from("comms_broadcasts")
    .select(
      "id, category, subject, message, recipient_count, created_at, edit_count, edited_at",
    )
    .eq("category", category)
    .eq("sender_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { rows: [], error: "Couldn't load your sent messages." };

  const broadcasts = data ?? [];
  const counts = await attachCounts(broadcasts.map((b) => b.id));

  return {
    rows: broadcasts.map((b) => ({
      id: b.id,
      category: b.category as CommsChannelKey,
      subject: b.subject ?? "",
      message: b.message ?? "",
      recipient_count: b.recipient_count,
      created_at: b.created_at,
      edit_count: b.edit_count,
      edited_at: b.edited_at,
      attachment_count: counts.get(b.id) ?? 0,
      sender: null,
    })),
    error: null,
  };
}

export type ChannelFeedAttachment = {
  path: string;
  kind: "image" | "video";
  name: string;
  url: string;
};

export async function fetchBroadcastAttachments(
  broadcastIds: string[],
): Promise<Record<string, ChannelFeedAttachment[]>> {
  const grouped: Record<string, ChannelFeedAttachment[]> = {};
  if (!broadcastIds.length) return grouped;

  const { data: atts } = await supabase
    .from("comms_broadcast_attachments")
    .select("broadcast_id, path, kind, file_name, sort_order")
    .in("broadcast_id", broadcastIds)
    .order("sort_order", { ascending: true });

  if (!atts?.length) return grouped;

  const signed = await createCommsAttachmentSignedUrls(atts.map((a) => a.path));
  atts.forEach((a) => {
    const url = signed.get(a.path);
    if (!url) return;
    (grouped[a.broadcast_id] ||= []).push({
      path: a.path,
      kind: a.kind === "video" ? "video" : "image",
      name: a.file_name ?? "attachment",
      url,
    });
  });
  return grouped;
}
