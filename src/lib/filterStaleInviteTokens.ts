import { supabase } from "@/integrations/supabase/client";

/**
 * Global invite-eligibility only: drop hot-sheet invite tokens whose payload
 * references a contact or Hot Sheet that is present in the payload AND confirmed
 * missing. Tokens lacking those fields are kept. If a lookup fails, nothing is
 * dropped (fail safe — keeps prior behavior).
 */
export async function filterStaleInviteTokens<T>(tokens: T[]): Promise<T[]> {
  const payloadOf = (t: T) =>
    ((t as { payload?: Record<string, unknown> | null }).payload ?? {}) as Record<string, unknown>;
  const clientIds = new Set<string>();
  const sheetIds = new Set<string>();
  for (const t of tokens) {
    const p = payloadOf(t);
    if (typeof p.client_id === "string" && p.client_id) clientIds.add(p.client_id);
    if (typeof p.hot_sheet_id === "string" && p.hot_sheet_id) sheetIds.add(p.hot_sheet_id);
  }
  if (clientIds.size === 0 && sheetIds.size === 0) return tokens;

  const [cRes, hRes] = await Promise.all([
    clientIds.size
      ? supabase.from("clients").select("id").in("id", [...clientIds])
      : Promise.resolve({ data: [], error: null }),
    sheetIds.size
      ? supabase.from("hot_sheets").select("id").in("id", [...sheetIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  const liveClients = cRes.error ? null : new Set((cRes.data ?? []).map((r: { id: string }) => String(r.id)));
  const liveSheets = hRes.error ? null : new Set((hRes.data ?? []).map((r: { id: string }) => String(r.id)));

  return tokens.filter((t) => {
    const p = payloadOf(t);
    if (liveClients && typeof p.client_id === "string" && p.client_id && !liveClients.has(p.client_id)) return false;
    if (liveSheets && typeof p.hot_sheet_id === "string" && p.hot_sheet_id && !liveSheets.has(p.hot_sheet_id)) return false;
    return true;
  });
}
