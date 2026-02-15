import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight heartbeat: updates agent_settings.last_seen_at every 2 minutes
 * while the agent is online. Used to determine offline status for email notifications.
 */
export function useAgentPresence() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const sendHeartbeat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("agent_settings")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id);
    };

    // Initial heartbeat
    sendHeartbeat();

    // Repeat every 2 minutes
    intervalRef.current = setInterval(sendHeartbeat, 2 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
