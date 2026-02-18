import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketSignals {
  relistCount7d: number;
  priceChangeCount7d: number;
  backOnMarketCount7d: number;
  avgDaysBetweenRelists: number | null;
}

export interface BuyerDemandTown {
  town: string;
  state: string;
  count: number;
}

export interface BuyerDemandBand {
  label: string;
  min: number;
  max: number | null;
  count: number;
}

export interface BuyerDemand {
  topTowns: BuyerDemandTown[];
  topPriceBands: BuyerDemandBand[];
  newNeedsCount7d: number;
}

export interface ActiveHotSheetItem {
  id: string;
  name: string;
  matchCount: number;
  pendingInviteCount: number;
  pendingTokenIds: string[];
  pendingInvitedEmails: string[];
  lastActivity: string | null;
}

export interface NetworkIntelligenceSummary {
  marketSignals: MarketSignals;
  buyerDemand: BuyerDemand;
  activeHotSheets: ActiveHotSheetItem[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNetworkIntelligence(): {
  summary: NetworkIntelligenceSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [summary, setSummary] = useState<NetworkIntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const loadIdRef = useRef(0);

  const loadAll = useCallback(async () => {
    const myId = ++loadIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Not authenticated");

      const agentId = user.id;

      // ── Wave 1 — edge fn (network aggregates) + agent-owned data in parallel ─
      const [aggregatesResult, hotSheetsRes, unacceptedTokensRes] = await Promise.all([
        // Network-wide aggregates via service-role edge function (RLS-safe)
        supabase.functions.invoke("network-intelligence-aggregates"),

        // Agent's active hot sheets (client-side, RLS-scoped to agent)
        supabase
          .from("hot_sheets")
          .select("id, name, updated_at, created_at")
          .eq("user_id", agentId)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(10),

        // Agent's unaccepted tokens (client-side, RLS-scoped to agent)
        supabase
          .from("share_tokens")
          .select("id, payload, created_at, accepted_at")
          .eq("agent_id", agentId)
          .is("accepted_at", null),
      ]);

      if (!mountedRef.current || loadIdRef.current !== myId) return;

      if (aggregatesResult.error) {
        throw new Error(aggregatesResult.error.message ?? "Failed to load network aggregates");
      }

      // ── Unpack aggregates from edge function ─────────────────────────────────
      const agg = aggregatesResult.data as {
        marketSignals: {
          relistCount7d: number;
          backOnMarketCount7d: number;
          priceChangeCount7d: number;
          avgDaysBetweenRelists: number | null;
        };
        buyerDemand: {
          newNeedsCount7d: number;
          topTowns: BuyerDemandTown[];
          topPriceBands: BuyerDemandBand[];
        };
      };

      const relistCount7d = agg.marketSignals.relistCount7d;
      const backOnMarketCount7d = agg.marketSignals.backOnMarketCount7d;
      const priceChangeCount7d = agg.marketSignals.priceChangeCount7d;
      const avgDaysBetweenRelists = agg.marketSignals.avgDaysBetweenRelists;
      const newNeedsCount7d = agg.buyerDemand.newNeedsCount7d;
      const topTowns: BuyerDemandTown[] = agg.buyerDemand.topTowns;
      const topPriceBands: BuyerDemandBand[] = agg.buyerDemand.topPriceBands;

      // ── Active Hot Sheets (agent-owned, client-side) ─────────────────────────

      const agentHotSheets = (hotSheetsRes.data ?? []) as any[];
      const unacceptedTokens = (unacceptedTokensRes.data ?? []) as any[];

      // Group pending invite tokens by hot_sheet_id
      const pendingByHotSheet = new Map<
        string,
        { tokenIds: string[]; emails: string[] }
      >();

      for (const tok of unacceptedTokens) {
        const p = tok.payload ?? {};
        if (p.type !== "client_hotsheet_invite") continue;
        const hsId: string = p.hot_sheet_id ?? "";
        if (!hsId) continue;
        if (!pendingByHotSheet.has(hsId)) {
          pendingByHotSheet.set(hsId, { tokenIds: [], emails: [] });
        }
        const entry = pendingByHotSheet.get(hsId)!;
        entry.tokenIds.push(tok.id);
        if (p.client_email) entry.emails.push(p.client_email);
      }

      // ── Wave 2 — hot sheet match counts ─────────────────────────────────────
      // Call check_hot_sheet_matches RPC for each hot sheet (parallel, cap at 10)
      const matchResults = await Promise.allSettled(
        agentHotSheets.map((hs) =>
          supabase.rpc("check_hot_sheet_matches", { p_hot_sheet_id: hs.id })
        )
      );

      if (!mountedRef.current || loadIdRef.current !== myId) return;

      const activeHotSheets: ActiveHotSheetItem[] = agentHotSheets.map(
        (hs, i) => {
          const matchResult = matchResults[i];
          const matchData =
            matchResult.status === "fulfilled" ? (matchResult.value.data ?? []) : [];
          const matchCount = (matchData as any[]).length;

          const pending = pendingByHotSheet.get(hs.id) ?? {
            tokenIds: [],
            emails: [],
          };

          return {
            id: hs.id,
            name: hs.name ?? "Hot Sheet",
            matchCount,
            pendingInviteCount: pending.tokenIds.length,
            pendingTokenIds: pending.tokenIds,
            pendingInvitedEmails: pending.emails,
            lastActivity: hs.updated_at ?? hs.created_at ?? null,
          };
        }
      );

      // Sort: hot sheets with pending invites or new matches float to top
      activeHotSheets.sort((a, b) => {
        const scoreA = a.pendingInviteCount * 10 + a.matchCount;
        const scoreB = b.pendingInviteCount * 10 + b.matchCount;
        return scoreB - scoreA;
      });

      if (!mountedRef.current || loadIdRef.current !== myId) return;

      setSummary({
        marketSignals: {
          relistCount7d,
          priceChangeCount7d,
          backOnMarketCount7d,
          avgDaysBetweenRelists,
        },
        buyerDemand: {
          topTowns,
          topPriceBands,
          newNeedsCount7d,
        },
        activeHotSheets,
      });
    } catch (err: any) {
      if (!mountedRef.current || loadIdRef.current !== myId) return;
      setError(err.message ?? "Unknown error");
    } finally {
      if (mountedRef.current && loadIdRef.current === myId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadAll();
    return () => {
      mountedRef.current = false;
    };
  }, [loadAll]);

  return { summary, loading, error, refetch: loadAll };
}
