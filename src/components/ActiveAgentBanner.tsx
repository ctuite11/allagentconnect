import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncStickyFromDB } from "@/utils/agentTracking";

export function ActiveAgentBanner() {
  const [agent, setAgent] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
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
        .select("*")
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
    <div className="w-full bg-muted border-b border-border px-4 py-2 text-sm flex items-center justify-center">
      <span>
        You're currently working with{" "}
        <span className="font-medium">
          {agent.first_name} {agent.last_name}
        </span>
      </span>
    </div>
  );
}
