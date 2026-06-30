import { useEffect, useState } from "react";
import { X, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const dismissedKey = (userId: string) => `commsCenterDefaultsNoticeDismissed:${userId}`;

type Props = { userId: string | null | undefined };

/**
 * Non-blocking inline notice in the Communications Center.
 * Explains that channels are on by default. Hidden once dismissed or once
 * the agent has explicitly configured preferences.
 */
export function CommunicationsDefaultsNotice({ userId }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setVisible(false);
      return;
    }

    if (localStorage.getItem(dismissedKey(userId)) === "true") {
      setVisible(false);
      return;
    }

    const evaluate = async () => {
      try {
        const { data } = await supabase
          .from("agent_settings")
          .select("preferences_set")
          .eq("user_id", userId)
          .maybeSingle();
        if (cancelled) return;
        setVisible(data?.preferences_set !== true);
      } catch {
        if (!cancelled) setVisible(false);
      }
    };

    void evaluate();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!visible) return null;

  const dismiss = () => {
    if (userId) localStorage.setItem(dismissedKey(userId), "true");
    setVisible(false);
  };

  return (
    <div className="relative rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notice"
        className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
      >
        <X className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <div className="flex gap-3 pr-6">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" strokeWidth={2} aria-hidden />
        <p className="text-[13px] leading-relaxed text-neutral-700">
          Your communication channels are on by default so you don&apos;t miss network activity. You can adjust them anytime.
        </p>
      </div>
    </div>
  );
}