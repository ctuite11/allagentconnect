import type { SupabaseClient } from "@supabase/supabase-js";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

/**
 * Buyer-self "New Matches" count for the Buyer Dashboard.
 *
 * "New" = currently matches one of the buyer's hot-sheet criteria AND has not
 * yet been recorded as sent in `hot_sheet_sent_listings`. The baseline (initial
 * matches at acceptance time) is written by `process-hot-sheet` in
 * `baselineOnly` mode from `accept-client-hot-sheet-invite`, so a brand-new
 * accepted hot sheet starts at 0.
 *
 * Reads sent listings via the security-definer RPC `list_sent_listings_for_member`
 * since buyers cannot SELECT `hot_sheet_sent_listings` directly via RLS.
 */
export async function fetchBuyerSelfNewMatchesCount(
  supabase: SupabaseClient,
  hotSheets: Array<{ id: string; criteria: Record<string, unknown> | null }>,
): Promise<number> {
  try {
    const sheets = hotSheets.filter((s) => s.id && s.criteria);
    if (sheets.length === 0) return 0;

    const ids = sheets.map((s) => s.id);
    const { data: sentRowsRaw } = await supabase.rpc(
      "list_sent_listings_for_member" as never,
      { _hot_sheet_ids: ids } as never,
    );

    const sentBySheet = new Map<string, Set<string>>();
    for (const row of (sentRowsRaw as Array<{ hot_sheet_id: string; listing_id: string }> | null) ?? []) {
      const hsId = String(row.hot_sheet_id);
      const lid = String(row.listing_id);
      if (!sentBySheet.has(hsId)) sentBySheet.set(hsId, new Set());
      sentBySheet.get(hsId)!.add(lid);
    }

    const newIds = new Set<string>();
    for (const sheet of sheets) {
      try {
        const { data: matched } = await buildListingsQuery(
          supabase,
          sheet.criteria as Parameters<typeof buildListingsQuery>[1],
        ).limit(200);
        const sent = sentBySheet.get(sheet.id) ?? new Set<string>();
        for (const l of matched ?? []) {
          const id = l?.id != null ? String(l.id) : "";
          if (id && !sent.has(id)) newIds.add(id);
        }
      } catch {
        /* skip malformed criteria */
      }
    }

    return newIds.size;
  } catch (e) {
    console.warn("[fetchBuyerSelfNewMatchesCount]", e);
    return 0;
  }
}