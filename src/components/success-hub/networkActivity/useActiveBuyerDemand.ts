import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BuyerDemandAgent = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type BuyerDemandLiveItem = {
  id: string;
  buyerLabel: string;
  location: string;
  priceRange: string;
  propertyType: string;
  timestamp: string;
  isNew: boolean;
  agent: BuyerDemandAgent | null;
};

function formatPrice(n: number | null | undefined) {
  if (!n || n <= 0) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

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

function truncate(s: string, n = 60) {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1).trimEnd()}…`;
}

export function useActiveBuyerDemand(limit = 6) {
  const [items, setItems] = useState<BuyerDemandLiveItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: needs, error } = await supabase
        .from("client_needs")
        .select(
          "id, submitted_by, property_type, property_types, county_id, max_price, bedrooms, bathrooms, description, created_at, city, state",
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (cancelled) return;
      if (error || !needs || needs.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const agentIds = Array.from(
        new Set(needs.map((n: any) => n.submitted_by).filter(Boolean)),
      ) as string[];

      const agentMap = new Map<string, BuyerDemandAgent>();
      if (agentIds.length > 0) {
        const { data: agents } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, email, phone")
          .in("id", agentIds);
        (agents || []).forEach((a: any) => {
          const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "AAC Agent";
          agentMap.set(a.id, {
            id: a.id,
            name,
            email: a.email ?? null,
            phone: a.phone ?? null,
          });
        });
      }

      const now = Date.now();
      const mapped: BuyerDemandLiveItem[] = needs.map((n: any) => {
        const city = (n.city ?? "").trim();
        const state = (n.state ?? "").trim();
        const location = [city, state].filter(Boolean).join(", ");
        const propertyType =
          (Array.isArray(n.property_types) && n.property_types[0]) ||
          n.property_type ||
          "Any type";
        const beds = n.bedrooms ? `${n.bedrooms}+ bed` : null;
        const propertyLine = [propertyType, beds].filter(Boolean).join(" · ");
        const priceRange = n.max_price ? `Up to ${formatPrice(n.max_price)}` : "Open budget";
        const descLabel = n.description
          ? truncate(String(n.description).split("\n")[0], 60)
          : null;
        const buyerLabel = descLabel
          ? `Buyer need · ${descLabel}`
          : `Buyer need · ${city || "New buyer"}`;
        const createdAt = n.created_at as string;
        const isNew = now - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
        return {
          id: n.id,
          buyerLabel,
          location: location || "Location flexible",
          priceRange,
          propertyType: propertyLine,
          timestamp: relativeTime(createdAt),
          isNew,
          agent: n.submitted_by ? agentMap.get(n.submitted_by) ?? null : null,
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