import { useCallback } from "react";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import {
  clearActiveOwnerContext,
  setActiveOwnerContext,
} from "@/lib/agentDelegatesApi";

export function useActiveAgentAccount() {
  const { enabled: delegatesEnabled } = useFeatureFlag("agent_account_delegates");
  const {
    user,
    isLicensedOwner,
    isDelegate,
    activeOwnerUserId,
    delegateMemberships,
    refreshRole,
  } = useAuthRole();

  const isActingAsOwner =
    delegatesEnabled &&
    !!activeOwnerUserId &&
    !!user?.id &&
    activeOwnerUserId !== user.id;

  const effectiveOwnerUserId =
    delegatesEnabled && activeOwnerUserId ? activeOwnerUserId : user?.id ?? null;

  const switchToOwner = useCallback(
    async (ownerUserId: string) => {
      const result = await setActiveOwnerContext(ownerUserId);
      if (!result.ok) {
        return result;
      }
      await refreshRole();
      return result;
    },
    [refreshRole],
  );

  const returnToSelf = useCallback(async () => {
    const result = await clearActiveOwnerContext();
    if (!result.ok) {
      return result;
    }
    await refreshRole();
    return result;
  }, [refreshRole]);

  return {
    user,
    delegatesEnabled,
    isLicensedOwner,
    isDelegate,
    isActingAsOwner,
    effectiveOwnerUserId,
    activeOwnerUserId,
    delegateMemberships,
    switchToOwner,
    returnToSelf,
    refreshRole,
  };
}
