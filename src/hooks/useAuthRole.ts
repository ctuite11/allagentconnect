import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type Role = "agent" | "buyer" | null;

interface AuthRoleState {
  user: User | null;
  role: Role;
  loading: boolean;
}

export function useAuthRole(): AuthRoleState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState<boolean>(true);

  async function loadUserAndRole() {
    setLoading(true);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }

    setUser(user);

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Error loading role", roleError);
      setRole(null);
    } else {
      setRole((roleRow?.role as Role) ?? null);
    }

    setLoading(false);
  }

  useEffect(() => {
    // initial load
    loadUserAndRole();

    // reload whenever auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, _session) => {
      loadUserAndRole();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading };
}
