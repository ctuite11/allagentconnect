import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type Role = "agent" | "admin" | "buyer" | null;

interface AuthRoleState {
  user: User | null;
  role: Role;
  loading: boolean;
  isAdmin: boolean;
}

export function useAuthRole(): AuthRoleState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const initialLoadDone = useRef(false);

  // Load role for a given user using has_role RPC (SECURITY DEFINER - bulletproof)
  async function loadRoleForUser(userId: string) {
    // PRIORITY 1: Check for admin role using has_role RPC (not table select)
    const { data: hasAdminRole, error: adminError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!adminError && hasAdminRole === true) {
      setRole("admin");
      setIsAdmin(true);
      return;
    }

    // PRIORITY 2: Check for agent role using has_role RPC
    const { data: hasAgentRole } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "agent",
    });

    if (hasAgentRole === true) {
      setRole("agent");
      setIsAdmin(false);
      return;
    }

    // Fallback: no recognized role
    setRole(null);
    setIsAdmin(false);
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
        setIsAdmin(false);
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
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading, isAdmin };
}
