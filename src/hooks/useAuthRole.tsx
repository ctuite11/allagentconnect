import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserRole } from "@/lib/resolveUserRole";
import type { ResolvedRole } from "@/lib/resolveUserRole";
import type { User } from "@supabase/supabase-js";

type Role = ResolvedRole | null;

export interface AuthRoleState {
  user: User | null;
  role: Role;
  loading: boolean;
  isAdmin: boolean;
  isVerifiedAgent: boolean;
}

const AuthRoleContext = createContext<AuthRoleState | null>(null);

/**
 * Single subscriber to Supabase auth + role resolution — mount once at app root.
 * Prevents duplicate session/role flashes when many routes/components consumed auth separately.
 */
export function AuthRoleProvider({ children }: { children: ReactNode }) {
  const state = useAuthRoleStore();
  return <AuthRoleContext.Provider value={state}>{children}</AuthRoleContext.Provider>;
}

/** Auth + role snapshot (shared singleton via `AuthRoleProvider`). */
export function useAuthRole(): AuthRoleState {
  const ctx = useContext(AuthRoleContext);
  if (!ctx) {
    throw new Error(
      "[useAuthRole] Wrap the app with <AuthRoleProvider> (inside BrowserRouter near App root).",
    );
  }
  return ctx;
}

function useAuthRoleStore(): AuthRoleState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerifiedAgent, setIsVerifiedAgent] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const initialLoadDone = useRef(false);

  const loadRoleForUser = useCallback(async (userId: string) => {
    let result = await resolveUserRole(userId);
    if (result.role === "unknown") {
      await new Promise((r) => setTimeout(r, 200));
      result = await resolveUserRole(userId);
    }
    const nextRole: Role = result.role === "unknown" ? null : result.role;
    setRole(nextRole);
    setIsAdmin(result.role === "admin");
    setIsVerifiedAgent(result.is_verified_agent);
  }, []);

  useEffect(() => {
    async function initialLoad() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.warn("[AUTH] getSession failed on bootstrap; leaving session for onAuthStateChange:", error);
        setLoading(false);
        initialLoadDone.current = true;
        return;
      }

      const sessionUser = session?.user ?? null;
      if (!sessionUser) {
        setUser(null);
        setRole(null);
        setIsAdmin(false);
        setIsVerifiedAgent(false);
        setLoading(false);
        initialLoadDone.current = true;
        return;
      }

      setUser(sessionUser);
      await loadRoleForUser(sessionUser.id);
      setLoading(false);
      initialLoadDone.current = true;
    }

    void initialLoad();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!initialLoadDone.current) return;

      if (event === "SIGNED_OUT") {
        setUser(null);
        setRole(null);
        setIsAdmin(false);
        setIsVerifiedAgent(false);
        return;
      }

      const newUser = session?.user ?? null;
      if (newUser) {
        setUser(newUser);
        void loadRoleForUser(newUser.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadRoleForUser]);

  return useMemo(
    () => ({ user, role, loading, isAdmin, isVerifiedAgent }),
    [user, role, loading, isAdmin, isVerifiedAgent],
  );
}
