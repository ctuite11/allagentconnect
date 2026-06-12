import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChannelPreviewAgent = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type ChannelPreviewItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  timestamp: string;
  agent: ChannelPreviewAgent | null;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function truncate(s: string, n = 70): string {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trimEnd()}…`;
}

async function fetchAgentMap(ids: string[]): Promise<Map<string, ChannelPreviewAgent>> {
  const map = new Map<string, ChannelPreviewAgent>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("agent_profiles")
    .select("id, first_name, last_name, email, phone")
    .in("id", ids);
  (data || []).forEach((a: any) => {
    const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "AAC Agent";
    map.set(a.id, { id: a.id, name, email: a.email ?? null, phone: a.phone ?? null });
  });
  return map;
}

type BroadcastCategory =
  | "buyer_need"
  | "sales_intel"
  | "renter_need"
  | "general_discussion";

function useBroadcastsPreview(category: BroadcastCategory, limit: number) {
  const [items, setItems] = useState<ChannelPreviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("comms_broadcasts" as any)
        .select("id, sender_id, subject, message, created_at")
        .eq("category", category)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (cancelled) return;
      if (error || !data) {
        setItems([]);
        setLoading(false);
        return;
      }

      const agentIds = Array.from(
        new Set((data as any[]).map((b) => b.sender_id).filter(Boolean)),
      ) as string[];
      const agentMap = await fetchAgentMap(agentIds);

      const mapped: ChannelPreviewItem[] = (data as any[]).map((b) => ({
        id: b.id,
        title: truncate(String(b.subject || "New message"), 80),
        subtitle: b.message ? truncate(String(b.message).split("\n")[0], 100) : null,
        timestamp: relativeTime(b.created_at),
        agent: b.sender_id ? agentMap.get(b.sender_id) ?? null : null,
      }));

      setItems(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [category, limit]);

  return { items, loading };
}

export function useBuyerNeedsPreview(limit = 3) {
  return useBroadcastsPreview("buyer_need", limit);
}

export function useRenterNeedsPreview(limit = 3) {
  return useBroadcastsPreview("renter_need", limit);
}

export function useSalesIntelPreview(limit = 3) {
  return useBroadcastsPreview("sales_intel", limit);
}

export function useGeneralDiscussionsPreview(limit = 3) {
  return useBroadcastsPreview("general_discussion", limit);
}