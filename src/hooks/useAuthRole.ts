import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserRole } from "@/lib/resolveUserRole";
import type { ResolvedRole } from "@/lib/resolveUserRole";
import type { User } from "@supabase/supabase-js";

type Role = ResolvedRole | null;

interface AuthRoleState {
  user: User | null;
  role: Role;
  loading: boolean;
  isAdmin: boolean;
  isVerifiedAgent: boolean;
}

export function useAuthRole(): AuthRoleState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerifiedAgent, setIsVerifiedAgent] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const initialLoadDone = useRef(false);

  async function loadRoleForUser(userId: string) {
    const result = await resolveUserRole(userId);
    setRole(result.role === "unknown" ? null : result.role);
    setIsAdmin(result.role === "admin");
    setIsVerifiedAgent(result.is_verified_agent);
  }

  useEffect(() => {
    async function initialLoad() {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        // Stale/invalid session — purge and reset
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.warn("[AUTH] signOut failed during stale session cleanup:", e);
        }
        setUser(null);
        setRole(null);
        setIsAdmin(false);
        setIsVerifiedAgent(false);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initialLoadDone.current) return;

      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        setTimeout(() => {
          loadRoleForUser(newUser.id);
        }, 0);
      } else {
        setRole(null);
        setIsAdmin(false);
        setIsVerifiedAgent(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading, isAdmin, isVerifiedAgent };
}
