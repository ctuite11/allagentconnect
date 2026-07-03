import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuthRole } from "@/hooks/useAuthRole";

export function useActiveAgentAccount() {
  const { enabled: delegatesEnabled } = useFeatureFlag("agent_account_delegates");
  const {
    user,
    role,
    isLicensedOwner,
    isDelegate,
    activeOwnerUserId,
    refreshRole,
  } = useAuthRole();

  const isDelegateUser = role === "delegate" || isDelegate;

  const isActingAsOwner =
    delegatesEnabled &&
    isDelegateUser &&
    !!activeOwnerUserId &&
    !!user?.id &&
    activeOwnerUserId !== user.id;

  const effectiveOwnerUserId =
    delegatesEnabled && activeOwnerUserId ? activeOwnerUserId : user?.id ?? null;

  return {
    user,
    delegatesEnabled,
    isLicensedOwner,
    isDelegate: isDelegateUser,
    isActingAsOwner: delegatesEnabled && (isDelegateUser || isActingAsOwner),
    effectiveOwnerUserId,
    activeOwnerUserId,
    refreshRole,
  };
}
