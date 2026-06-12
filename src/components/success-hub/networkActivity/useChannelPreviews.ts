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

const RENTAL_TYPES = new Set(["residential_rental", "commercial_rental"]);

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

function formatPrice(n: number | null | undefined): string {
  if (!n || n <= 0) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
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

function useClientNeedsPreview(kind: "buyer" | "renter", limit: number) {
  const [items, setItems] = useState<ChannelPreviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Over-fetch to allow client-side rental partitioning, then trim.
      const { data, error } = await supabase
        .from("client_needs")
        .select(
          "id, submitted_by, property_type, property_types, max_price, bedrooms, description, created_at, city, state",
        )
        .order("created_at", { ascending: false })
        .limit(limit * 6);

      if (cancelled) return;
      if (error || !data) {
        setItems([]);
        setLoading(false);
        return;
      }

      const filtered = data.filter((n: any) => {
        const types: string[] = [
          ...(Array.isArray(n.property_types) ? n.property_types : []),
          n.property_type,
        ].filter(Boolean);
        const isRental = types.some((t) => RENTAL_TYPES.has(String(t)));
        return kind === "renter" ? isRental : !isRental;
      }).slice(0, limit);

      const agentIds = Array.from(
        new Set(filtered.map((n: any) => n.submitted_by).filter(Boolean)),
      ) as string[];
      const agentMap = await fetchAgentMap(agentIds);

      const mapped: ChannelPreviewItem[] = filtered.map((n: any) => {
        const city = (n.city ?? "").trim();
        const state = (n.state ?? "").trim();
        const location = [city, state].filter(Boolean).join(", ");
        const descLabel = n.description ? truncate(String(n.description).split("\n")[0], 70) : null;
        const title = descLabel || (location ? `${kind === "renter" ? "Renter need" : "Buyer need"} · ${location}` : kind === "renter" ? "New renter need" : "New buyer need");
        const price = n.max_price ? `Up to ${formatPrice(n.max_price)}` : null;
        const subtitle = [location || null, price].filter(Boolean).join(" · ") || null;
        return {
          id: n.id,
          title,
          subtitle,
          timestamp: relativeTime(n.created_at),
          agent: n.submitted_by ? agentMap.get(n.submitted_by) ?? null : null,
        };
      });

      setItems(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, limit]);

  return { items, loading };
}

export function useBuyerNeedsPreview(limit = 3) {
  return useClientNeedsPreview("buyer", limit);
}

export function useRenterNeedsPreview(limit = 3) {
  return useClientNeedsPreview("renter", limit);
}

export function useSalesIntelPreview(limit = 3) {
  const [items, setItems] = useState<ChannelPreviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("listings")
        .select(
          "id, address, city, state, price, agent_id, listing_type, status, created_at, updated_at",
        )
        .eq("listing_type", "for_sale")
        .not("status", "in", "(draft,expired)")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (cancelled) return;
      if (error || !data) {
        setItems([]);
        setLoading(false);
        return;
      }

      const agentIds = Array.from(
        new Set(data.map((l: any) => l.agent_id).filter(Boolean)),
      ) as string[];
      const agentMap = await fetchAgentMap(agentIds);

      const mapped: ChannelPreviewItem[] = data.map((l: any) => {
        const loc = [l.city, l.state].filter(Boolean).join(", ");
        const subtitle = [loc || null, l.price ? formatPrice(l.price) : null]
          .filter(Boolean)
          .join(" · ") || null;
        return {
          id: l.id,
          title: truncate(String(l.address || "New listing"), 70),
          subtitle,
          timestamp: relativeTime(l.updated_at ?? l.created_at),
          agent: l.agent_id ? agentMap.get(l.agent_id) ?? null : null,
        };
      });

      setItems(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { items, loading };
}

export function useGeneralDiscussionsPreview(limit = 3) {
  const [items, setItems] = useState<ChannelPreviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // RLS limits to messages addressed to the current agent — fine for a preview.
      const { data, error } = await supabase
        .from("agent_messages")
        .select("id, agent_id, sender_name, sender_email, sender_phone, message, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (cancelled) return;
      if (error || !data) {
        setItems([]);
        setLoading(false);
        return;
      }

      const mapped: ChannelPreviewItem[] = data.map((m: any) => ({
        id: m.id,
        title: truncate(String(m.message || "New discussion"), 80),
        subtitle: null,
        timestamp: relativeTime(m.created_at),
        agent: {
          id: m.agent_id, // sender is external — link to recipient agent profile
          name: m.sender_name || "Sender",
          email: m.sender_email ?? null,
          phone: m.sender_phone ?? null,
        },
      }));

      setItems(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { items, loading };
}