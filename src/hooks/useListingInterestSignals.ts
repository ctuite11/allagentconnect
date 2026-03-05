import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ListingSignals {
  saves_count: number;
  comments_count: number;
  hotsheet_match_count: number;
}

/**
 * Fetches buyer interest signals (saves, comments, hot sheet matches)
 * for a set of listing IDs, scoped to the agent's own client network.
 */
export function useListingInterestSignals(
  agentId: string | null,
  listingIds: string[],
) {
  const [signals, setSignals] = useState<Record<string, ListingSignals>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId || listingIds.length === 0) {
      setSignals({});
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc(
          "get_listing_interest_signals",
          {
            p_agent_id: agentId,
            p_listing_ids: listingIds,
          },
        );

        if (!cancelled && !error && data) {
          const map: Record<string, ListingSignals> = {};
          for (const row of data as any[]) {
            map[row.listing_id] = {
              saves_count: Number(row.saves_count),
              comments_count: Number(row.comments_count),
              hotsheet_match_count: Number(row.hotsheet_match_count),
            };
          }
          setSignals(map);
        }
      } catch (err) {
        console.error("useListingInterestSignals error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId, listingIds.join(",")]);

  return { signals, loading };
}
