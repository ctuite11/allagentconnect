import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncStickyFromDB } from "@/utils/agentTracking";

interface AgentBannerProfile {
  first_name: string | null;
  last_name: string | null;
}

export function ActiveAgentBanner() {
  const [agent, setAgent] = useState<AgentBannerProfile | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAgent(null);
        return;
      }

      // DB is the source of truth — sync sticky first
      const agentId = await syncStickyFromDB();
      if (!agentId) return;

      // Check if current user is an agent (agents don't see the banner)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (agentProfile) return;
      }

      // Fetch the sticky agent's display info
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name")
        .eq("id", agentId)
        .maybeSingle();

      if (!error && data) {
        setAgent(data);
      }
    };

    load();
  }, []);

  if (!agent) return null;

  return (
    <div className="bg-[#0E56F5] text-white" style={{ backgroundColor: "#0E56F5" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-[12px]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/90 align-middle" aria-hidden />
        <span className="tracking-[0.01em]">
          Working with <span className="font-medium text-white">{agent.first_name} {agent.last_name}</span>
          <span className="mx-2 text-white/40">|</span>
          <span className="text-white/85">Direct Connect MLS Partner</span>
        </span>
      </div>
    </div>
  );
}
