import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for admin role checks.
 * Uses the SECURITY DEFINER `has_role` RPC function.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin" as const,
  });

  if (error) {
    console.error("[isAdmin] rpc error", error);
    return false;
  }

  return data === true;
}
