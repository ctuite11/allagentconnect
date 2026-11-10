import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Isolated until Supabase types are regenerated after the reviewed migration.
export async function privacyRpc<T>(name: "get_shared_listing" | "get_shared_hot_sheet" |
  "get_buyer_listing" | "get_buyer_agent" | "get_dcmls_listing_agent" | "get_dcmls_agent_profile" |
  "create_listing_share_link" | "replace_listing_share_link" | "revoke_listing_share_link" |
  "list_listing_share_links" | "set_listing_external_sharing" | "request_new_listing_share_link",
args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as SupabaseClient).rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const privacyReadClient = supabase as SupabaseClient;

export interface SharedAgent {
  id: string; first_name: string; last_name: string; company?: string;
  email?: string; phone?: string; cell_phone?: string; headshot_url?: string;
}
export interface SharedListing {
  id: string; address: string; unit_number?: string; city: string; state: string;
  price: number; price_range_min?: number; price_range_max?: number;
  bedrooms?: number; bathrooms?: number; square_feet?: number; description?: string;
  photos: { url: string }[]; floor_plans: { url: string }[];
}
export interface SharedHotSheet {
  hot_sheet: { id: string; name: string; criteria: Record<string, unknown>; user_id: string; is_active: boolean };
  agent: SharedAgent; listings: SharedListing[];
}
