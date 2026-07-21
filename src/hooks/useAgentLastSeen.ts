import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds

interface LastSeenResult {
  lastSeenAt: string | null;
  isOnline: boolean;
}

/**
 * Query agent_settings.last_seen_at for a single user.
 * Returns isOnline = true only when last_seen_at is within the last 5 minutes.
 * Refreshes every 60 seconds.
 */
export function useAgentLastSeen(userId: string | undefined): LastSeenResult {
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) {
      setLastSeenAt(null);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase.rpc("get_agent_presence", {
        user_ids: [userId],
      });
      const row = Array.isArray(data) ? data[0] : null;
      setLastSeenAt(row?.last_seen_at ?? null);
    };

    fetch();
    intervalRef.current = setInterval(fetch, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  const isOnline =
    lastSeenAt != null &&
    Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;

  return { lastSeenAt, isOnline };
}

/**
 * Batch-fetch last_seen_at for multiple user IDs.
 * Returns a Map of userId -> { lastSeenAt, isOnline }.
 * Refreshes every 60 seconds.
 */
export function useAgentPresenceBatch(userIds: string[]): Map<string, LastSeenResult> {
  const [map, setMap] = useState<Map<string, LastSeenResult>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idsKey = userIds.slice().sort().join(",");

  useEffect(() => {
    if (userIds.length === 0) {
      setMap(new Map());
      return;
    }

    const fetch = async () => {
      const { data } = await supabase.rpc("get_agent_presence", {
        user_ids: userIds,
      });

      const next = new Map<string, LastSeenResult>();
      const now = Date.now();

      for (const id of userIds) {
        const row = Array.isArray(data) ? data.find((r) => r.user_id === id) : undefined;
        const ls = row?.last_seen_at ?? null;
        next.set(id, {
          lastSeenAt: ls,
          isOnline: ls != null && now - new Date(ls).getTime() < ONLINE_THRESHOLD_MS,
        });
      }

      setMap(next);
    };

    fetch();
    intervalRef.current = setInterval(fetch, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [idsKey]);

  return map;
}
