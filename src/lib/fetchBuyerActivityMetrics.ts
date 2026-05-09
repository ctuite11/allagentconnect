import type { SupabaseClient } from "@supabase/supabase-js";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

export type BuyerActivityMetrics = {
  matches: number;
  views: number;
  favorites: number;
  hotSheets: number;
  messages: number;
};

const emptyMetrics = (): BuyerActivityMetrics => ({
  matches: 0,
  views: 0,
  favorites: 0,
  hotSheets: 0,
  messages: 0,
});

/**
 * Aggregates buyer-facing activity for a CRM client across all hot sheets they are linked to.
 * Matches = distinct listing ids union across criteria queries (cap 200/sheet).
 * Views = sum of listing_stats.view_count for those listings.
 */
export async function fetchBuyerActivityMetrics(
  supabase: SupabaseClient,
  crmClientId: string,
): Promise<BuyerActivityMetrics> {
  try {
    const { data: hscRows, error: hscErr } = await supabase
      .from("hot_sheet_clients")
      .select("hot_sheet_id")
      .eq("client_id", crmClientId);

    if (hscErr) throw hscErr;

    const hsIds = [...new Set((hscRows ?? []).map((r: { hot_sheet_id?: string }) => r.hot_sheet_id).filter(Boolean))] as string[];

    if (hsIds.length === 0) return emptyMetrics();

    const hotSheets = hsIds.length;

    const [favRes, msgRes] = await Promise.all([
      supabase.from("hot_sheet_favorites").select("id", { count: "exact", head: true }).in("hot_sheet_id", hsIds),
      supabase.from("hot_sheet_comments").select("id", { count: "exact", head: true }).in("hot_sheet_id", hsIds),
    ]);

    const favorites = favRes.count ?? 0;
    const messages = msgRes.count ?? 0;

    const { data: hsData, error: hsErr } = await supabase
      .from("hot_sheets")
      .select("id, criteria")
      .in("id", hsIds);

    if (hsErr) throw hsErr;

    const listingIdSet = new Set<string>();
    for (const hs of hsData ?? []) {
      const criteria = hs.criteria as Record<string, unknown> | null;
      if (!criteria || typeof criteria !== "object") continue;
      try {
        const { data: matched } = await buildListingsQuery(supabase, criteria).limit(200);
        for (const l of matched ?? []) {
          if (l?.id) listingIdSet.add(String(l.id));
        }
      } catch {
        /* skip sheet */
      }
    }

    const matches = listingIdSet.size;

    let views = 0;
    const ids = [...listingIdSet];
    const chunkSize = 150;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data: statsRows } = await supabase.from("listing_stats").select("view_count").in("listing_id", chunk);
      for (const row of statsRows ?? []) {
        views += Number((row as { view_count?: number }).view_count ?? 0);
      }
    }

    return { matches, views, favorites, hotSheets, messages };
  } catch (e) {
    console.warn("[fetchBuyerActivityMetrics]", e);
    return emptyMetrics();
  }
}
