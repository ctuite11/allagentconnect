import { supabase } from "@/integrations/supabase/client";

/**
 * App roles that can be checked via the has_role RPC.
 * SECURITY DEFINER function bypasses RLS safely.
 */
export type AppRole = "admin" | "agent" | "buyer";

/**
 * Single source of truth for role checks.
 * Uses the SECURITY DEFINER `has_role` RPC function.
 */
export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: role,
  });

  if (error) {
    console.error(`[hasRole] rpc error for role "${role}"`, error);
    return false;
  }

  return data === true;
}

/**
 * Convenience function for admin checks (alias).
 */
export async function checkIsAdminRole(userId: string): Promise<boolean> {
  return hasRole(userId, "admin");
}
