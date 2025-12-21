import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type Role = "agent" | "admin" | "buyer" | null;

interface AuthRoleState {
  user: User | null;
  role: Role;
  loading: boolean;
}

export function useAuthRole(): AuthRoleState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const initialLoadDone = useRef(false);

  // Load role for a given user - doesn't set loading state
  async function loadRoleForUser(userId: string) {
    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) {
      console.error("Error loading role", roleError);
      setRole(null);
    } else {
      setRole((roleRow?.role as Role) ?? null);
    }
  }

  useEffect(() => {
    // Initial load - only this sets loading=true
    async function initialLoad() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setUser(null);
        setRole(null);
        setLoading(false);
        initialLoadDone.current = true;
        return;
      }

      setUser(user);
      await loadRoleForUser(user.id);
      setLoading(false);
      initialLoadDone.current = true;
    }

    initialLoad();

    // Auth state change listener - does NOT set loading=true
    // This prevents component unmounting when switching tabs
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only update state after initial load is complete
      if (!initialLoadDone.current) return;

      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        // Defer role fetch to avoid deadlock
        setTimeout(() => {
          loadRoleForUser(newUser.id);
        }, 0);
      } else {
        setRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading };
}
