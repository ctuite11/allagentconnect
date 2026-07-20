import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const cardShell =
  "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md";

type Schedule = "immediate" | "daily" | "weekly";

const scheduleOptions: { value: Schedule; label: string; description: string }[] = [
  { value: "immediate", label: "Immediately", description: "Get emails as activity happens." },
  { value: "daily", label: "Daily digest", description: "One summary email per day." },
  { value: "weekly", label: "Weekly digest", description: "One summary email per week." },
];

const normalizeSchedule = (value: unknown): Schedule => {
  if (value === "daily" || value === "weekly") return value;
  return "immediate";
};

export const ClientNeedsNotificationSettings = () => {
  const [schedule, setSchedule] = useState<Schedule>("immediate");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.from("notification_preferences").select("*").eq("user_id", user.id).single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        const prefs = data as any;
        setSchedule(normalizeSchedule(prefs.client_needs_schedule));
      }
    } catch (error) {
      console.error("Error fetching notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSchedule = async (next: Schedule) => {
    if (next === schedule) return;
    const previous = schedule;
    setSchedule(next);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: user.id,
            client_needs_enabled: true,
            new_matches_enabled: true,
            client_needs_schedule: next,
          },
          { onConflict: "user_id" },
        );

      if (error) throw error;

      // Mark preferences as explicitly set so the default-on notice stops.
      try {
        await supabase.from("agent_settings").update({ preferences_set: true }).eq("user_id", user.id);
      } catch (e) {
        console.warn("[ClientNeedsNotificationSettings] preferences_set update skipped:", e);
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
      setSchedule(previous);
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <Card className={cn(cardShell)}>
          <CardHeader className="space-y-2 p-0 pb-3">
            <Skeleton className="h-5 w-56 rounded-md bg-neutral-100" />
            <Skeleton className="h-3 w-full max-w-xl rounded-md bg-neutral-100" />
          </CardHeader>
          <CardContent className="space-y-3 p-0">
            <Skeleton className="h-10 w-full rounded-lg bg-neutral-100" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className={cn(cardShell)}>
      <CardHeader className="space-y-1 p-0">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 shrink-0 !text-[#16A34A]" strokeWidth={2} aria-hidden />
          <CardTitle className="text-base font-semibold text-neutral-900">Notification timing</CardTitle>
        </div>
        <p className="text-[13px] leading-relaxed text-neutral-500">
          Choose how often we email you about Comms Center activity. Which categories you receive is controlled by the channel toggles below.
        </p>
      </CardHeader>
      <CardContent className="mt-4 grid grid-cols-1 gap-2 p-0 sm:grid-cols-3">
        {scheduleOptions.map((option) => {
          const active = schedule === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => updateSchedule(option.value)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-start rounded-xl border bg-white px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-[#0E56F5] ring-1 ring-[#0E56F5]/20"
                  : "border-neutral-200 hover:border-neutral-300",
              )}
            >
              <span className={cn("text-[13px] font-semibold", active ? "text-[#0E56F5]" : "text-neutral-900")}>
                {option.label}
              </span>
              <span className="mt-0.5 text-xs text-neutral-500">{option.description}</span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
};
