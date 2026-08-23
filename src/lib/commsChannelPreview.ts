import { supabase } from "@/integrations/supabase/client";
import type { CommsChannelKey } from "@/lib/commsChannelPrefs";
import { commsRelativeTime } from "@/lib/commsChannels";

export type LatestReceivedPreview = {
  id: string;
  subject: string;
  message: string;
  createdAt: string;
  timestamp: string;
  agentName: string;
  hasAttachment: boolean;
};

export async function fetchLatestReceivedPreview(
  category: CommsChannelKey,
): Promise<LatestReceivedPreview | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("comms_broadcasts")
    .select("id, subject, message, created_at, sender_id")
    .eq("category", category)
    .neq("sender_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;

  const row = data[0];
  let agentName = "AAC Agent";
  if (row.sender_id) {
    const { data: agent } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name")
      .eq("id", row.sender_id)
      .maybeSingle();
    if (agent) {
      agentName = `${agent.first_name ?? ""} ${agent.last_name ?? ""}`.trim() || agentName;
    }
  }

  const { count } = await supabase
    .from("comms_broadcast_attachments")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", row.id);

  return {
    id: row.id,
    subject: String(row.subject || "New message").trim(),
    message: String(row.message || "").trim(),
    createdAt: row.created_at,
    timestamp: commsRelativeTime(row.created_at),
    agentName,
    hasAttachment: (count ?? 0) > 0,
  };
}
