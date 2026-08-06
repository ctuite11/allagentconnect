import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight heartbeat: updates agent_settings.last_seen_at every 2 minutes
 * while the agent is online. Also fires on mount, window focus, and visibility return.
 *
 * Heartbeats are only written for presence-eligible accounts: agent role +
 * verified + activated (account_activated_at set). This mirrors the
 * agent_presence view's rule, so ineligible accounts never generate new
 * heartbeats and stale ones are filtered out at read time.
 */
export function useAgentPresence() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // null = not checked yet; cached for the lifetime of the mount.
  const eligibleRef = useRef<boolean | null>(null);
  // Timestamp of the last successful write, used to throttle bursts caused by
  // focus + visibilitychange + interval all firing around the same moment.
  const lastWriteRef = useRef<number>(0);

  const checkEligibility = useCallback(async (userId: string): Promise<boolean> => {
    if (eligibleRef.current !== null) return eligibleRef.current;

    const [settingsRes, roleRes] = await Promise.all([
      supabase
        .from("agent_settings")
        .select("agent_status, account_activated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "agent")
        .limit(1),
    ]);

    const settings = settingsRes.data;
    const eligible =
      settings?.agent_status === "verified" &&
      settings?.account_activated_at != null &&
      (roleRes.data?.length ?? 0) > 0;

    eligibleRef.current = eligible;
    return eligible;
  }, []);

  const sendHeartbeat = useCallback(async () => {
    // Never write while the tab is in the background — a hidden tab is not
    // an online agent, and background timers were the single largest source
    // of database write volume.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    // Throttle: at most one write per 90s regardless of how many triggers fire.
    const now = Date.now();
    if (now - lastWriteRef.current < 90 * 1000) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!(await checkEligibility(user.id))) return;

    lastWriteRef.current = Date.now();
    await supabase
      .from("agent_settings")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }, [checkEligibility]);

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
