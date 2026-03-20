import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight heartbeat: updates agent_settings.last_seen_at every 2 minutes
 * while the agent is online. Also fires on mount, window focus, and visibility return.
 */
export function useAgentPresence() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendHeartbeat = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("agent_settings")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }, []);

  useEffect(() => {
    // Initial heartbeat
    sendHeartbeat();

    // Repeat every 2 minutes
    intervalRef.current = setInterval(sendHeartbeat, 2 * 60 * 1000);

    // Fire on window focus
    const onFocus = () => sendHeartbeat();
    window.addEventListener("focus", onFocus);

    // Fire on visibility return
    const onVisibility = () => {
      if (document.visibilityState === "visible") sendHeartbeat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sendHeartbeat]);
}
