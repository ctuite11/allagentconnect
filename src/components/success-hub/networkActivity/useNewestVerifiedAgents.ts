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
      const { data: settings, error: settingsError } = await supabase
        .from("agent_settings")
        .select("user_id, verified_at")
        .eq("agent_status", "verified")
        .order("verified_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (cancelled) return;
      if (settingsError || !settings || settings.length === 0) {
        setAgents([]);
        setLoading(false);
        return;
      }
      const ids = settings.map((s: any) => s.user_id).filter(Boolean);
      const { data: profiles, error: profilesError } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, company, headshot_url, office_city, office_state")
        .in("id", ids);
      if (cancelled) return;
      if (profilesError || !profiles) {
        setAgents([]);
        setLoading(false);
        return;
      }
      const byId = new Map<string, any>(profiles.map((p: any) => [p.id, p]));
      const mapped: NewestVerifiedAgent[] = ids
        .map((id: string) => byId.get(id))
        .filter(Boolean)
        .map((a: any) => {
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