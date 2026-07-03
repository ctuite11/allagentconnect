import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useActiveAgentAccount } from "@/hooks/useActiveAgentAccount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function displayName(value: string | null | undefined, fallback = "account owner") {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

export function DelegateContextBanner() {
  const {
    delegatesEnabled,
    isActingAsOwner,
    activeOwnerUserId,
    returnToSelf,
    delegateMemberships,
    switchToOwner,
  } = useActiveAgentAccount();
  const [ownerName, setOwnerName] = useState("account owner");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!delegatesEnabled || !activeOwnerUserId) return;

    let cancelled = false;
    void (async () => {
      const membership = delegateMemberships.find((m) => m.owner_user_id === activeOwnerUserId);
      if (membership?.display_name) {
        if (!cancelled) setOwnerName(displayName(membership.display_name));
        return;
      }

      const { data } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name")
        .eq("id", activeOwnerUserId)
        .maybeSingle();

      if (!cancelled && data) {
        setOwnerName(
          displayName([data.first_name, data.last_name].filter(Boolean).join(" ")),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [delegatesEnabled, activeOwnerUserId, delegateMemberships]);

  if (!delegatesEnabled || !isActingAsOwner) return null;

  const handleReturn = async () => {
    setSwitching(true);
    const result = await returnToSelf();
    setSwitching(false);
    if (!result.ok) {
      toast.error(result.error || "Could not switch back to your account");
      return;
    }
    toast.success("Returned to your account");
  };

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

  return (
    <div className="bg-[#0E56F5] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-1.5 text-[12px]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/90" aria-hidden />
        <span className="tracking-[0.01em]">
          Acting as <span className="font-medium text-white">{ownerName}</span>
        </span>
        {delegateMemberships.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            {delegateMemberships
              .filter((m) => m.owner_user_id !== activeOwnerUserId)
              .map((m) => (
                <Button
                  key={m.owner_user_id}
                  size="sm"
                  variant="secondary"
                  className="h-6 bg-white/15 px-2 text-[11px] text-white hover:bg-white/25"
                  disabled={switching}
                  onClick={() => void handleSwitch(m.owner_user_id)}
                >
                  {displayName(m.display_name, "Other account")}
                </Button>
              ))}
          </div>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="h-6 bg-white/15 px-2 text-[11px] text-white hover:bg-white/25"
          disabled={switching}
          onClick={() => void handleReturn()}
        >
          Return to my account
        </Button>
      </div>
    </div>
  );
}
