import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "agent" | "buyer";

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

export async function checkIsAdminRole(userId: string): Promise<boolean> {
  return hasRole(userId, "admin");
}
