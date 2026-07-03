import { useState } from "react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useActiveAgentAccount } from "@/hooks/useActiveAgentAccount";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users } from "lucide-react";

function displayName(value: string | null | undefined, fallback: string) {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

export function DelegateMembershipCard() {
  const { enabled: delegatesEnabled, loading: flagLoading } = useFeatureFlag("agent_account_delegates");
  const { user } = useAuthRole();
  const {
    isDelegate,
    delegateMemberships,
    activeOwnerUserId,
    switchToOwner,
    returnToSelf,
  } = useActiveAgentAccount();
  const [switching, setSwitching] = useState(false);

  if (flagLoading || !delegatesEnabled || !isDelegate) return null;

  const handleSwitch = async (ownerUserId: string) => {
    setSwitching(true);
    const result = await switchToOwner(ownerUserId);
    setSwitching(false);
    if (!result.ok) {
      toast.error(result.error || "Could not switch account");
      return;
    }
    toast.success("Switched account context");
  };

  const handleReturn = async () => {
    setSwitching(true);
    const result = await returnToSelf();
    setSwitching(false);
    if (!result.ok) {
      toast.error(result.error || "Could not return to your account");
      return;
    }
    toast.success("Returned to your account");
  };

  const actingAsOwner =
    activeOwnerUserId && user?.id && activeOwnerUserId !== user.id;

  return (
    <AgentSectionCard className="space-y-4 p-5 md:p-6">
      <div>
        <h2 className={agentSectionTitle}>Delegate Access</h2>
        <p className={`mt-0.5 ${agentSectionDesc}`}>
          Choose which agent account you are acting on behalf of.
        </p>
      </div>

      <div className="space-y-2">
        {delegateMemberships.map((membership) => {
          const isActive = activeOwnerUserId === membership.owner_user_id;
          return (
            <div
              key={membership.owner_user_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {displayName(membership.display_name, "Account owner")}
                </p>
                {membership.role_label && (
                  <p className="text-xs text-neutral-500">{membership.role_label}</p>
                )}
              </div>
              <Button
                size="sm"
                variant={isActive ? "default" : "outline"}
                disabled={switching || isActive}
                onClick={() => void handleSwitch(membership.owner_user_id)}
              >
                {isActive ? "Active" : "Act as this account"}
              </Button>
            </div>
          );
        })}
      </div>

      {actingAsOwner && (
        <Button size="sm" variant="outline" disabled={switching} onClick={() => void handleReturn()}>
          Return to my account
        </Button>
      )}

      {delegateMemberships.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Users className="h-4 w-4" />
          No delegate memberships yet.
        </div>
      )}
    </AgentSectionCard>
  );
}
