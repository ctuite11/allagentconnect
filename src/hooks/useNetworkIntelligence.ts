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
  pendingTokenIds: string[]; // for resend: first one
  pendingInvitedEmails: string[];
  lastActivity: string | null;
}

export interface NetworkIntelligenceSummary {
  marketSignals: MarketSignals;
  buyerDemand: BuyerDemand;
  activeHotSheets: ActiveHotSheetItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const PRICE_BANDS: Array<{ label: string; min: number; max: number | null }> = [
  { label: "Under $300K", min: 0, max: 300_000 },
  { label: "$300K–$500K", min: 300_000, max: 500_000 },
  { label: "$500K–$750K", min: 500_000, max: 750_000 },
  { label: "$750K–$1M", min: 750_000, max: 1_000_000 },
  { label: "$1M–$2M", min: 1_000_000, max: 2_000_000 },
  { label: "$2M+", min: 2_000_000, max: null },
];

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
      const since7d = daysAgoISO(7);

      // ── Wave 1 — all parallel ────────────────────────────────────────────────
      const [
        relistRes,
        priceChangeRes,
        backOnMarketRes,
        avgDaysRes,
        hotSheetsRes,
        unacceptedTokensRes,
        clientNeedsRes,
        allHotSheetsForDemandRes,
      ] = await Promise.all([
        // Relisted listings network-wide (last 7d)
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("is_relisting", true)
          .gte("created_at", since7d),

        // Price changes (last 7d) — from favorite_price_history (network-wide)
        supabase
          .from("favorite_price_history")
          .select("id", { count: "exact", head: true })
          .gte("changed_at", since7d),

        // Back-on-market (status = 'active' where is_relisting=false but recently reactivated)
        // proxy: listings with status='active' and active_date in last 7d that are NOT new
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gte("active_date", since7d)
          .eq("is_relisting", false),

        // Avg days between relists (network-wide) — pull data and compute in JS
        supabase
          .from("listings")
          .select("created_at, cancelled_at")
          .eq("is_relisting", true)
          .not("cancelled_at", "is", null)
          .limit(200),

        // Agent's active hot sheets
        supabase
          .from("hot_sheets")
          .select("id, name, updated_at, created_at")
          .eq("user_id", agentId)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(10),

        // Agent's unaccepted tokens (for pending invite count per hot sheet)
        supabase
          .from("share_tokens")
          .select("id, payload, created_at, accepted_at")
          .eq("agent_id", agentId)
          .is("accepted_at", null),

        // New buyer needs (last 7d, network-wide count only — no PII)
        supabase
          .from("client_needs")
          .select("id, state, city, max_price, created_at", { count: "exact" })
          .gte("created_at", since7d)
          .limit(500),

        // All network hot sheets (active) for buyer demand extraction
        supabase
          .from("hot_sheets")
          .select("criteria, updated_at")
          .eq("is_active", true)
          .limit(500),
      ]);

      if (!mountedRef.current || loadIdRef.current !== myId) return;

      // ── Market Signals ───────────────────────────────────────────────────────

      const relistCount7d = (relistRes.count as number | null) ?? 0;
      const priceChangeCount7d = (priceChangeRes.count as number | null) ?? 0;
      const backOnMarketCount7d = (backOnMarketRes.count as number | null) ?? 0;

      // Avg days between relists: compute from pairs
      let avgDaysBetweenRelists: number | null = null;
      const relistRows = (avgDaysRes.data ?? []) as any[];
      if (relistRows.length > 0) {
        const deltas: number[] = [];
        for (const r of relistRows) {
          if (r.cancelled_at && r.created_at) {
            const cancelledMs = new Date(r.cancelled_at).getTime();
            const createdMs = new Date(r.created_at).getTime();
            const days = Math.max(0, Math.floor((createdMs - cancelledMs) / 86_400_000));
            if (days >= 0 && days <= 365) deltas.push(days);
          }
        }
        if (deltas.length > 0) {
          avgDaysBetweenRelists = Math.round(
            deltas.reduce((a, b) => a + b, 0) / deltas.length
          );
        }
      }

      // ── Buyer Demand ─────────────────────────────────────────────────────────

      const newNeedsCount7d = (clientNeedsRes.count as number | null) ?? 0;

      // Extract top towns from all active hot sheets criteria
      const townCounts = new Map<string, { count: number; state: string }>();
      const hsRows = (allHotSheetsForDemandRes.data ?? []) as any[];

      for (const hs of hsRows) {
        const criteria = hs.criteria ?? {};
        const cities: string[] = Array.isArray(criteria.cities) ? criteria.cities : [];
        const state: string = typeof criteria.state === "string" ? criteria.state : "";
        for (const city of cities) {
          if (!city?.trim()) continue;
          const key = `${city.trim().toLowerCase()}|${state.trim().toUpperCase()}`;
          const existing = townCounts.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            townCounts.set(key, { count: 1, state: state.trim().toUpperCase() });
          }
        }
      }

      const topTowns: BuyerDemandTown[] = Array.from(townCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 6)
        .map(([key, v]) => ({
          town: key.split("|")[0].replace(/\b\w/g, (c) => c.toUpperCase()),
          state: v.state,
          count: v.count,
        }));

      // Extract price bands from hot sheets
      const bandCounts = new Map<string, number>(
        PRICE_BANDS.map((b) => [b.label, 0])
      );

      for (const hs of hsRows) {
        const criteria = hs.criteria ?? {};
        const maxPrice = criteria.maxPrice ? Number(criteria.maxPrice) : null;
        if (!maxPrice) continue;
        for (const band of PRICE_BANDS) {
          if (maxPrice > band.min && (band.max === null || maxPrice <= band.max)) {
            bandCounts.set(band.label, (bandCounts.get(band.label) ?? 0) + 1);
            break;
          }
        }
      }

      const topPriceBands: BuyerDemandBand[] = PRICE_BANDS.map((b) => ({
        ...b,
        count: bandCounts.get(b.label) ?? 0,
      }))
        .filter((b) => b.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      // ── Active Hot Sheets ────────────────────────────────────────────────────

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
