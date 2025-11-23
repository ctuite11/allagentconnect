import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPrimaryAgentId } from "@/utils/agentTracking";

export function ActiveAgentBanner() {
  const [agent, setAgent] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      // Check if current user is an agent
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        
        // If logged-in user is an agent, don't show banner
        if (agentProfile) {
          return;
        }
      }

      // Proceed with existing logic for non-agent users
      const agentId = getPrimaryAgentId();
      if (!agentId) return;

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
    <div className="w-full bg-blue-50 border-b border-blue-100 px-4 py-2 text-sm flex items-center justify-center">
      <span>
        You're currently working with{" "}
        <span className="font-medium">
          {agent.first_name} {agent.last_name}
        </span>
      </span>
    </div>
  );
}
