import { useEffect, useState } from "react";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { supabase } from "@/integrations/supabase/client";

function displayName(first: string | null | undefined, last: string | null | undefined, fallback: string) {
  const value = [first, last].filter(Boolean).join(" ").trim();
  return value || fallback;
}

export function DelegateContextBanner() {
  const { enabled: delegatesEnabled } = useFeatureFlag("agent_account_delegates");
  const { role, isDelegate, activeOwnerUserId, ownerDisplayName } = useAuthRole();
  const [ownerName, setOwnerName] = useState(ownerDisplayName || "this account");

  const showBanner =
    delegatesEnabled && (role === "delegate" || isDelegate) && !!activeOwnerUserId;

  useEffect(() => {
    if (!showBanner || !activeOwnerUserId) return;

    if (ownerDisplayName) {
      setOwnerName(ownerDisplayName);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name")
        .eq("id", activeOwnerUserId)
        .maybeSingle();

      if (!cancelled && data) {
        setOwnerName(displayName(data.first_name, data.last_name, "this account"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showBanner, activeOwnerUserId, ownerDisplayName]);

  if (!showBanner) return null;

  return (
    <div className="bg-[#0E56F5] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-[12px]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/90" aria-hidden />
        <span className="tracking-[0.01em]">
          Working in <span className="font-medium text-white">{ownerName}&apos;s Account</span>
        </span>
      </div>
    </div>
  );
}
