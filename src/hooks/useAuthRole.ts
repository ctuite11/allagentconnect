import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserRole } from "@/lib/resolveUserRole";
import type { ResolvedRole } from "@/lib/resolveUserRole";
import type { User } from "@supabase/supabase-js";

type Role = ResolvedRole | null;

const dbgAuthRole = (msg: string, data?: Record<string, unknown>) => {
  if (import.meta.env.DEV) console.log("[AAC_DEBUG RouteGuard/useAuthRole]", msg, data ?? {});
};

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
    dbgAuthRole("loadRoleForUser:start", { userId });
    let result = await resolveUserRole(userId);
    // Transient RPC hiccups would flash role → null → buyer; retry once before dropping role.
    if (result.role === "unknown") {
      await new Promise((r) => setTimeout(r, 200));
      result = await resolveUserRole(userId);
      dbgAuthRole("loadRoleForUser:retry_unknown", {
        userId,
        roleAfterRetry: result.role,
      });
    }
    const nextRole: Role = result.role === "unknown" ? null : result.role;
    setRole(nextRole);
    setIsAdmin(result.role === "admin");
    setIsVerifiedAgent(result.is_verified_agent);
    dbgAuthRole("loadRoleForUser:done", { userId, role: nextRole, isVerifiedAgent: result.is_verified_agent });
  }

  useEffect(() => {
    async function initialLoad() {
      const { data: { user }, error } = await supabase.auth.getUser();

      dbgAuthRole("initialLoad:getUser result", {
        error: error?.message,
        userId: user?.id ?? null,
      });

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
        dbgAuthRole("initialLoad:set loading false — no session", {});
        return;
      }

      setUser(user);
      await loadRoleForUser(user.id);
      setLoading(false);
      initialLoadDone.current = true;
      dbgAuthRole("initialLoad:set loading false — session ok", { userId: user.id });
    }

    initialLoad();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!initialLoadDone.current) return;

      dbgAuthRole("onAuthStateChange", {
        event,
        hasSession: Boolean(session?.user?.id),
        userId: session?.user?.id ?? null,
      });

      /** Only wipe local user on explicit sign-out. Other events sometimes race with null `session`. */
      if (event === "SIGNED_OUT") {
        dbgAuthRole("onAuthStateChange → clear user / role", { event });
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
      } else if (event === "INITIAL_SESSION") {
        dbgAuthRole("onAuthStateChange: INITIAL_SESSION empty — skip clearing (already handled)", { event });
      } else if (event === "TOKEN_REFRESHED") {
        dbgAuthRole("onAuthStateChange: TOKEN_REFRESHED missing user in payload — skipping clear", {});
      } else {
        dbgAuthRole("onAuthStateChange: non-SIGNED_OUT, no session user — skipping clear", { event });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading, isAdmin, isVerifiedAgent };
}
