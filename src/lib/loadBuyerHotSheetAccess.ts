import type { SupabaseClient } from "@supabase/supabase-js";

/** Hot sheet row shape returned by `list_hot_sheets_for_member` RPC. */
export interface BuyerHotSheetRow {
  id: string;
  name: string;
  criteria: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
  last_sent_at?: string | null;
  is_active: boolean;
  user_id?: string | null;
}

interface ShareTokenRow {
  token: string | null;
  payload: unknown;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
}

export interface BuyerHotSheetAccess {
  ids: string[];
  rows: BuyerHotSheetRow[];
  /** hotSheetId → invite token (for sheets reached via /client/hotsheet/:token). */
  tokenByHotSheetId: Record<string, string>;
}

/**
 * Single source of truth for "which hot sheets can this buyer see?".
 *
 * After RLS hardening, buyers can't `SELECT` directly from `share_tokens` or
 * `hot_sheets`. This loader unions:
 *   1. `hot_sheet_clients` rows the buyer can see via the (now email-fallback)
 *      `can_authenticated_buyer_view_hot_sheet_client` policy, AND
 *   2. Accepted `client_hotsheet_invite` tokens via the
 *      `list_my_accepted_hot_sheet_tokens` RPC,
 * then hydrates full rows via the `list_hot_sheets_for_member` RPC (security
 * definer, bypasses the buyer SELECT gap on `hot_sheets`).
 */
export async function loadBuyerHotSheetAccess(
  supabase: SupabaseClient,
  userId: string,
  buyerEmail?: string | null,
): Promise<BuyerHotSheetAccess> {
  const buyerEmailNorm = (buyerEmail || "").toLowerCase().trim();

  const ids = new Set<string>();
  const tokenByHotSheetId: Record<string, string> = {};

  // 1) hot_sheet_clients — RLS-gated by the updated buyer policy.
  const { data: hscRows, error: hscErr } = await supabase
    .from("hot_sheet_clients")
    .select("hot_sheet_id");
  if (hscErr) {
    console.error("[loadBuyerHotSheetAccess] hot_sheet_clients", hscErr);
  } else {
    for (const row of hscRows || []) {
      const hid = (row as { hot_sheet_id?: string }).hot_sheet_id;
      if (hid) ids.add(hid);
    }
  }

  // 2) Accepted invite tokens via security-definer RPC.
  const { data: tokenRowsRaw, error: tokenErr } = await supabase
    .rpc("list_my_accepted_hot_sheet_tokens");
  if (tokenErr) {
    console.error("[loadBuyerHotSheetAccess] list_my_accepted_hot_sheet_tokens", tokenErr);
  } else {
    for (const tokenRow of (tokenRowsRaw || []) as ShareTokenRow[]) {
      const payload =
        tokenRow.payload && typeof tokenRow.payload === "object"
          ? (tokenRow.payload as Record<string, unknown>)
          : {};
      if (payload.type !== "client_hotsheet_invite") continue;

      const hotSheetId = String(payload.hot_sheet_id || "");
      if (!hotSheetId) continue;

      const matchByUserId = tokenRow.accepted_by_user_id === userId;
      const tokenEmail = String(payload.client_email || "").toLowerCase().trim();
      const matchByEmail = Boolean(buyerEmailNorm && tokenEmail === buyerEmailNorm);

      if (matchByUserId || matchByEmail) {
        ids.add(hotSheetId);
        if (tokenRow.token) tokenByHotSheetId[hotSheetId] = tokenRow.token;
      }
    }
  }

  if (!ids.size) {
    return { ids: [], rows: [], tokenByHotSheetId };
  }

  const { data: hotSheetRowsRaw, error: sheetErr } = await supabase.rpc(
    "list_hot_sheets_for_member" as never,
    { _hot_sheet_ids: [...ids] } as never,
  );

  if (sheetErr) {
    console.error("[loadBuyerHotSheetAccess] list_hot_sheets_for_member", sheetErr);
    return { ids: [...ids], rows: [], tokenByHotSheetId };
  }

  const rows = ((hotSheetRowsRaw as BuyerHotSheetRow[] | null) || [])
    .slice()
    .sort((a, b) => (b?.created_at ?? "").localeCompare(a?.created_at ?? ""));

  return { ids: [...ids], rows, tokenByHotSheetId };
}