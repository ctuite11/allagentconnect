import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NewestVerifiedAgent = {
  id: string;
  name: string;
  brokerage: string;
  market: string;
  headshotUrl: string | null;
};

export function useNewestVerifiedAgents(limit = 12) {
  const [agents, setAgents] = useState<NewestVerifiedAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, company, headshot_url, office_city, office_state, created_at, agent_settings!inner(agent_status, verified_at)")
        .eq("agent_settings.agent_status", "verified")
        .order("verified_at", { foreignTable: "agent_settings", ascending: false })
        .limit(limit);
      if (cancelled) return;
      if (error || !data) {
        setAgents([]);
        setLoading(false);
        return;
      }
      const mapped: NewestVerifiedAgent[] = data.map((a: any) => {
        const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || "Agent";
        const market = [a.office_city, a.office_state].filter(Boolean).join(", ");
        return {
          id: a.id,
          name,
          brokerage: a.company ?? "",
          market,
          headshotUrl: a.headshot_url ?? null,
        };
      });
      setAgents(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { agents, loading };
}