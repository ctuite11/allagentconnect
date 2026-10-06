import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { getPageData, setPageData } from "@/lib/pageDataCache";
import { isVisibleInAgentNetwork } from "@/lib/agentNetworkVisibility";

export type NewestVerifiedAgent = {
  id: string;
  name: string;
  brokerage: string;
  market: string;
  headshotUrl: string | null;
};

export function useNewestVerifiedAgents(limit = 12) {
  const cacheKey = `success-hub:newest-agents:${limit}`;
  const { user: authUser } = useAuthRole();
  const authUserId = authUser?.id ?? null;
  const [agents, setAgentsRaw] = useState<NewestVerifiedAgent[]>(
    () => getPageData<NewestVerifiedAgent[]>(cacheKey, authUserId)?.value ?? [],
  );
  const [loading, setLoading] = useState(() => !getPageData(cacheKey, authUserId));
  const setAgents = (v: NewestVerifiedAgent[]) => {
    setAgentsRaw(v);
    setPageData(cacheKey, authUserId, v);
  };

  useEffect(() => {
    const cached = getPageData<NewestVerifiedAgent[]>(cacheKey, authUserId);
    if (cached?.fresh) return;
    let cancelled = false;
    (async () => {
      if (!cached) setLoading(true);
      const { data, error } = await supabase.rpc("get_newest_verified_agents", { _limit: limit });
      if (cancelled) return;
      if (error || !data) {
        setAgents([]);
        setLoading(false);
        return;
      }
      const mapped: NewestVerifiedAgent[] = (data as any[])
        .filter(isVisibleInAgentNetwork)
        .slice(0, limit)
        .map((a) => {
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
  }, [limit, cacheKey, authUserId]);

  return { agents, loading };
}