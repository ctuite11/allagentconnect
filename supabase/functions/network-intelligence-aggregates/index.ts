import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_BANDS: Array<{ label: string; min: number; max: number | null }> = [
  { label: "Under $300K", min: 0, max: 300_000 },
  { label: "$300K–$500K", min: 300_000, max: 500_000 },
  { label: "$500K–$750K", min: 500_000, max: 750_000 },
  { label: "$750K–$1M", min: 750_000, max: 1_000_000 },
  { label: "$1M–$2M", min: 1_000_000, max: 2_000_000 },
  { label: "$2M+", min: 2_000_000, max: null },
];

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth gate ────────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Verify JWT by passing the raw token directly to getUser()
  const authedClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: userErr } = await authedClient.auth.getUser(token);
  if (userErr || !user?.id) {
    console.error("[network-intelligence-aggregates] Auth error:", userErr?.message);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // ── Service-role client for aggregate reads (RLS bypass) ────────────────────
  const admin = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const since7d = daysAgoISO(7);

  try {
    // ── Parallel queries ────────────────────────────────────────────────────
    const [
      relistRes,
      backOnMarketRes,
      avgDaysRes,
      priceChangeRes,
      clientNeedsRes,
      hotSheetsRes,
    ] = await Promise.all([
      // 1. Relisted count (7d)
      admin
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("is_relisting", true)
        .gte("created_at", since7d),

      // 2. Back-on-market count (7d) — active listings with active_date in window, not new relists
      admin
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gte("active_date", since7d)
        .eq("is_relisting", false),

      // 3. Avg relist gap — pull data, compute in JS
      admin
        .from("listings")
        .select("created_at, cancelled_at")
        .eq("is_relisting", true)
        .not("cancelled_at", "is", null)
        .limit(200),

      // 4. Tracked price changes (7d) — via favorite_price_history (service role bypasses RLS)
      admin
        .from("favorite_price_history")
        .select("id", { count: "exact", head: true })
        .gte("changed_at", since7d),

      // 5. New buyer needs count (7d) — count only, no PII
      admin
        .from("client_needs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7d),

      // 6. All active hot sheets for demand aggregation
      admin
        .from("hot_sheets")
        .select("criteria")
        .eq("is_active", true)
        .limit(500),
    ]);

    // ── Market Signals ───────────────────────────────────────────────────────

    const relistCount7d = (relistRes.count as number | null) ?? 0;
    const backOnMarketCount7d = (backOnMarketRes.count as number | null) ?? 0;
    const priceChangeCount7d = (priceChangeRes.count as number | null) ?? 0;

    // Avg days between relists
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
    const hsRows = (hotSheetsRes.data ?? []) as any[];

    // Top towns from hot sheet criteria
    const townCounts = new Map<string, { count: number; state: string }>();
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

    const topTowns = Array.from(townCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([key, v]) => ({
        town: key.split("|")[0].replace(/\b\w/g, (c) => c.toUpperCase()),
        state: v.state,
        count: v.count,
      }));

    // Top price bands from hot sheet criteria
    const bandCounts = new Map<string, number>(PRICE_BANDS.map((b) => [b.label, 0]));
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

    const topPriceBands = PRICE_BANDS.map((b) => ({
      ...b,
      count: bandCounts.get(b.label) ?? 0,
    }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    // ── Response ────────────────────────────────────────────────────────────

    const payload = {
      marketSignals: {
        relistCount7d,
        backOnMarketCount7d,
        priceChangeCount7d,
        avgDaysBetweenRelists,
      },
      buyerDemand: {
        newNeedsCount7d,
        topTowns,
        topPriceBands,
      },
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("[network-intelligence-aggregates] Error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
