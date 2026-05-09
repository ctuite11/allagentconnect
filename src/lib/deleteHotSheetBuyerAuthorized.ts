import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes a hot sheet and its `hot_sheet_clients` rows after RLS allows it.
 *
 * Product: buyers with access may remove the **entire** shared hot sheet group (everyone
 * on that sheet loses it). Owning agents cannot use this path for accepted/shared sheets
 * — RLS blocks; agents use `delete_pending_buyer_hot_sheet` only for pending invites.
 */
export async function deleteHotSheetWithClientLinks(
  client: SupabaseClient,
  hotSheetId: string,
): Promise<{ error: Error | null }> {
  const { error: clientsError } = await client
    .from("hot_sheet_clients")
    .delete()
    .eq("hot_sheet_id", hotSheetId);

  if (clientsError) {
    return { error: new Error(clientsError.message) };
  }

  const { error: sheetError } = await client.from("hot_sheets").delete().eq("id", hotSheetId);

  if (sheetError) {
    return { error: new Error(sheetError.message) };
  }

  return { error: null };
}
