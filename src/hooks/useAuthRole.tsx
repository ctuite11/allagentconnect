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
import {
  resolveUserRole,
  type DelegateMembershipSummary,
  type DeveloperAccountSummary,
} from "@/lib/resolveUserRole";
import type { ResolvedRole } from "@/lib/resolveUserRole";
import type { User } from "@supabase/supabase-js";

type Role = ResolvedRole | null;

export interface AuthRoleState {
  user: User | null;
  role: Role;
  loading: boolean;
  isAdmin: boolean;
  isVerifiedAgent: boolean;
  isLicensedOwner: boolean;
  isDelegate: boolean;
  activeOwnerUserId: string | null;
  ownerDisplayName: string | null;
  canAccessSuccessHub: boolean;
  delegateMemberships: import("@/lib/resolveUserRole").DelegateMembershipSummary[];
  /** Developer product shell access (AAC account type = developer). */
  isDeveloper: boolean;
  /** Development companies this user belongs to (development_account_members). */
  developerAccounts: DeveloperAccountSummary[];
  developerAccountCount: number;
  /** Set only when the developer manages exactly one company. */
  primaryDeveloperAccountId: string | null;
  refreshRole: () => Promise<void>;
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
  const [isLicensedOwner, setIsLicensedOwner] = useState(false);
  const [isDelegate, setIsDelegate] = useState(false);
  const [activeOwnerUserId, setActiveOwnerUserId] = useState<string | null>(null);
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null);
  const [canAccessSuccessHub, setCanAccessSuccessHub] = useState(false);
  const [delegateMemberships, setDelegateMemberships] = useState<DelegateMembershipSummary[]>([]);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [developerAccounts, setDeveloperAccounts] = useState<DeveloperAccountSummary[]>([]);
  const [developerAccountCount, setDeveloperAccountCount] = useState(0);
  const [primaryDeveloperAccountId, setPrimaryDeveloperAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const initialLoadDone = useRef(false);
  const roleResolutionId = useRef(0);
  const currentUserId = useRef<string | null>(null);
  const currentRole = useRef<Role>(null);
  const resolvingUserId = useRef<string | null>(null);
  currentUserId.current = user?.id ?? null;
  currentRole.current = role;

  const clearResolvedAccess = useCallback(() => {
    currentRole.current = null;
    setRole(null);
    setIsAdmin(false);
    setIsVerifiedAgent(false);
    setIsLicensedOwner(false);
    setIsDelegate(false);
    setActiveOwnerUserId(null);
    setOwnerDisplayName(null);
    setCanAccessSuccessHub(false);
    setDelegateMemberships([]);
    setIsDeveloper(false);
    setDeveloperAccounts([]);
    setDeveloperAccountCount(0);
    setPrimaryDeveloperAccountId(null);
  }, []);

  /** Never let a stalled auth/role call hang the app on a spinner forever. */
  const withTimeout = useCallback(async function <T>(
    promise: PromiseLike<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`[AUTH] ${label} timed out after ${ms}ms`)), ms),
      ),
    ]);
  }, []);

  const loadRoleForUser = useCallback(async (userId: string, resolutionId?: number) => {
    let result = await resolveUserRole(userId);
    if (result.role === "unknown") {
      await new Promise((r) => setTimeout(r, 200));
      result = await resolveUserRole(userId);
    }
    if (resolutionId !== undefined && roleResolutionId.current !== resolutionId) return;
    const nextRole: Role = result.role === "unknown" ? null : result.role;
    currentRole.current = nextRole;
    setRole(nextRole);
    setIsAdmin(result.role === "admin");
    setIsVerifiedAgent(result.is_verified_agent);
    setIsLicensedOwner(result.is_licensed_owner ?? false);
    setIsDelegate(result.is_delegate ?? false);
    setActiveOwnerUserId(result.active_owner_user_id ?? null);
    setOwnerDisplayName(result.owner_display_name ?? null);
    setCanAccessSuccessHub(result.can_access_success_hub ?? false);
    setDelegateMemberships(result.delegate_memberships ?? []);
    setIsDeveloper(result.is_developer ?? result.role === "developer");
    setDeveloperAccounts(result.developer_accounts ?? []);
    setDeveloperAccountCount(result.developer_account_count ?? 0);
    setPrimaryDeveloperAccountId(result.primary_developer_account_id ?? null);
  }, []);

  useEffect(() => {
    async function initialLoad() {
      let session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] = null;
      let error: unknown = null;
      try {
        const res = await withTimeout(supabase.auth.getSession(), 6000, "getSession");
        session = res.data.session;
        error = res.error;
      } catch (e) {
        error = e;
      }

      if (error) {
        console.warn("[AUTH] getSession failed on bootstrap; leaving session for onAuthStateChange:", error);
        initialLoadDone.current = true;
        if (!resolvingUserId.current) setLoading(false);
        return;
      }

      const sessionUser = session?.user ?? null;
      if (!sessionUser) {
        // A SIGNED_IN/INITIAL_SESSION event may have arrived while getSession
        // was waiting on the browser's auth-storage lock. Never overwrite that
        // newer, authoritative event with this stale empty bootstrap result.
        if (currentUserId.current || resolvingUserId.current) {
          initialLoadDone.current = true;
          return;
        }
        currentUserId.current = null;
        setUser(null);
        clearResolvedAccess();
        setLoading(false);
        initialLoadDone.current = true;
        return;
      }

      // onAuthStateChange can deliver the valid session before getSession
      // settles. Reuse the in-flight resolution instead of starting a second
      // request that can cancel the first one and leave the route spinning.
      if (
        currentUserId.current === sessionUser.id &&
        (currentRole.current !== null || resolvingUserId.current === sessionUser.id)
      ) {
        setUser(sessionUser);
        initialLoadDone.current = true;
        return;
      }

      const resolutionId = roleResolutionId.current + 1;
      roleResolutionId.current = resolutionId;
      currentUserId.current = sessionUser.id;
      resolvingUserId.current = sessionUser.id;
      setUser(sessionUser);
      clearResolvedAccess();
      try {
        await withTimeout(loadRoleForUser(sessionUser.id, resolutionId), 10000, "resolveUserRole");
      } catch (e) {
        console.warn("[AUTH] role resolution stalled on bootstrap:", e);
      } finally {
        if (roleResolutionId.current === resolutionId) {
          resolvingUserId.current = null;
        }
      }
      setLoading(false);
      initialLoadDone.current = true;
    }

    void initialLoad();

    // Hard watchdog: whatever happens, stop showing the global spinner.
    const watchdog = setTimeout(() => {
      if (!initialLoadDone.current) {
        console.warn("[AUTH] bootstrap watchdog fired; releasing loading state");
        initialLoadDone.current = true;
        setLoading(false);
      }
    }, 7000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        roleResolutionId.current += 1;
        currentUserId.current = null;
        resolvingUserId.current = null;
        setUser(null);
        clearResolvedAccess();
        setLoading(false);
        return;
      }

      // After a password update succeeds anywhere in the app, scrub any
      // recovery/setup markers. This guarantees a remount of AuthCallback
      // (or any other listener) cannot bounce a freshly-activated agent
      // back into a password form.
      if (event === "USER_UPDATED") {
        void import("@/lib/authRecovery").then(({ clearRecoveryState }) => {
          clearRecoveryState();
        });
      }

      const newUser = session?.user ?? null;
      if (newUser) {
        // Token refreshes and user metadata updates are common while a tab is
        // open. Do not erase a role that is already resolved for this user or
        // restart the route-level loading screen for those routine events.
        if (
          currentUserId.current === newUser.id &&
          (currentRole.current !== null || resolvingUserId.current === newUser.id)
        ) {
          setUser(newUser);
          return;
        }

        const resolutionId = roleResolutionId.current + 1;
        roleResolutionId.current = resolutionId;
        currentUserId.current = newUser.id;
        resolvingUserId.current = newUser.id;
        setUser(newUser);
        clearResolvedAccess();
        setLoading(true);

        // Defer backend work until after the auth callback returns. Starting a
        // new backend request inside onAuthStateChange can contend with the
        // auth client's session lock and leave the UI spinning indefinitely.
        window.setTimeout(() => {
          void withTimeout(
            loadRoleForUser(newUser.id, resolutionId),
            10000,
            `resolveUserRole:${event}`,
          )
            .catch((error) => {
              console.warn("[AUTH] role resolution failed after auth event:", error);
            })
            .finally(() => {
              if (roleResolutionId.current === resolutionId) {
                resolvingUserId.current = null;
                setLoading(false);
              }
            });
        }, 0);
      }
    });

    return () => {
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, [clearResolvedAccess, loadRoleForUser, withTimeout]);

  // Re-resolve role after admin approval while the tab stays open (e.g. pending → verified).
  useEffect(() => {
    const onFocus = () => {
      if (user?.id && role === "agent" && !isVerifiedAgent) {
        void loadRoleForUser(user.id);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id, role, isVerifiedAgent, loadRoleForUser]);

  return useMemo(
    () => ({
      user,
      role,
      loading,
      isAdmin,
      isVerifiedAgent,
      isLicensedOwner,
      isDelegate,
      activeOwnerUserId,
      ownerDisplayName,
      canAccessSuccessHub,
      delegateMemberships,
      refreshRole: async () => {
        if (user?.id) await loadRoleForUser(user.id);
      },
    }),
    [
      user,
      role,
      loading,
      isAdmin,
      isVerifiedAgent,
      isLicensedOwner,
      isDelegate,
      activeOwnerUserId,
      ownerDisplayName,
      canAccessSuccessHub,
      delegateMemberships,
      isDeveloper,
      developerAccounts,
      developerAccountCount,
      primaryDeveloperAccountId,
      loadRoleForUser,
    ],
  );
}
