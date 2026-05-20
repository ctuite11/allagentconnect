import type { SupabaseClient } from "@supabase/supabase-js";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { filterVisibleListings } from "@/lib/filterVisibleListings";

export type BuyerNewHotSheetMatchRow = Record<string, unknown> & {
  id: string;
  list_date?: string | null;
  created_at?: string | null;
  agent_id?: string | null;
  status?: string;
};

export type FetchBuyerNewHotSheetMatchesResult = {
  listings: BuyerNewHotSheetMatchRow[];
  buyerDisplayName: string;
  hotSheetCount: number;
};

/**
 * Listings that match any of the buyer's linked hot sheets and have not yet been
 * recorded in `hot_sheet_sent_listings` for that sheet (same "new match" rule as
 * `process-hot-sheet`).
 */
export async function fetchBuyerNewHotSheetMatches(
  supabase: SupabaseClient,
  crmClientId: string,
  agentUserId: string,
): Promise<FetchBuyerNewHotSheetMatchesResult> {
  const empty = (buyerDisplayName = ""): FetchBuyerNewHotSheetMatchesResult => ({
    listings: [],
    buyerDisplayName,
    hotSheetCount: 0,
  });

  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, agent_id")
    .eq("id", crmClientId)
    .maybeSingle();

  if (clientErr || !clientRow) return empty();

  if (String(clientRow.agent_id) !== agentUserId) return empty();

  const fn = typeof clientRow.first_name === "string" ? clientRow.first_name.trim() : "";
  const ln = typeof clientRow.last_name === "string" ? clientRow.last_name.trim() : "";
  const buyerDisplayName =
    [fn, ln].filter(Boolean).join(" ").trim() ||
    (typeof clientRow.email === "string" ? clientRow.email : "");

  const { data: hscRows, error: hscErr } = await supabase
    .from("hot_sheet_clients")
    .select("hot_sheet_id")
    .eq("client_id", crmClientId);

  if (hscErr) throw hscErr;

  const hotSheetIds = [
    ...new Set(
      (hscRows ?? [])
        .map((r: { hot_sheet_id?: string }) => r.hot_sheet_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (hotSheetIds.length === 0) {
    return { listings: [], buyerDisplayName, hotSheetCount: 0 };
  }

  const [{ data: sheetRows, error: sheetErr }, { data: sentRows, error: sentErr }] =
    await Promise.all([
      supabase.from("hot_sheets").select("id, criteria").in("id", hotSheetIds),
      supabase
        .from("hot_sheet_sent_listings")
        .select("hot_sheet_id, listing_id")
        .in("hot_sheet_id", hotSheetIds),
    ]);

  if (sheetErr) throw sheetErr;
  if (sentErr) throw sentErr;

  const sentBySheet = new Map<string, Set<string>>();
  for (const row of sentRows ?? []) {
    const hsId = String((row as { hot_sheet_id?: string }).hot_sheet_id ?? "");
    const lid = String((row as { listing_id?: string }).listing_id ?? "");
    if (!hsId || !lid) continue;
    if (!sentBySheet.has(hsId)) sentBySheet.set(hsId, new Set());
    sentBySheet.get(hsId)!.add(lid);
  }

  const listingById = new Map<string, BuyerNewHotSheetMatchRow>();

  for (const sheet of sheetRows ?? []) {
    const sheetId = String((sheet as { id?: string }).id ?? "");
    const criteria = (sheet as { criteria?: Record<string, unknown> | null }).criteria;
    if (!sheetId || !criteria || typeof criteria !== "object") continue;

    try {
      const { data: matched, error: matchErr } = await buildListingsQuery(
        supabase,
        criteria as Parameters<typeof buildListingsQuery>[1],
      ).limit(200);
      if (matchErr) {
        console.warn("[fetchBuyerNewHotSheetMatches] sheet", sheetId, matchErr.message);
        continue;
      }
      const sentIds = sentBySheet.get(sheetId) ?? new Set<string>();
      for (const listing of matched ?? []) {
        const id = listing?.id != null ? String(listing.id) : "";
        if (!id || sentIds.has(id)) continue;
        if (!listingById.has(id)) {
          listingById.set(id, listing as BuyerNewHotSheetMatchRow);
        }
      }
    } catch (e) {
      console.warn("[fetchBuyerNewHotSheetMatches] sheet", sheetId, e);
    }
  }

  let listings = filterVisibleListings([...listingById.values()], agentUserId);

  listings = [...listings].sort((a, b) => {
    const da = a.list_date ?? a.created_at ?? "";
    const db = b.list_date ?? b.created_at ?? "";
    return String(db).localeCompare(String(da));
  });

  return {
    listings,
    buyerDisplayName,
    hotSheetCount: hotSheetIds.length,
  };
}
