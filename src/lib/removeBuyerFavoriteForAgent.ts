import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function removeBuyerFavoriteForAgent(
  supabase: SupabaseClient<Database>,
  opts: {
    favoriteId: string;
    buyerUserId: string;
    crmClientId: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("remove_client_favorite_for_agent", {
    p_favorite_id: opts.favoriteId,
    p_buyer_user_id: opts.buyerUserId,
    p_crm_client_id: opts.crmClientId,
  });

  if (error) {
    const message =
      error.message.includes("No active relationship")
        ? "You don't have permission to update this buyer's favorites"
        : error.message.includes("Favorite not found")
          ? "Favorite not found"
          : "Failed to remove from favorites";
    return { ok: false, message };
  }

  return { ok: true };
}
