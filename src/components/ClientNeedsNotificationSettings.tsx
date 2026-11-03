import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { NotificationFrequencyCards, type NotificationFrequencyOption } from "@/components/filters";
import { cn } from "@/lib/utils";

const cardShell =
  "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md";

type Schedule = "immediate" | "daily" | "weekly";

const scheduleOptions: readonly NotificationFrequencyOption[] = [
  {
    value: "immediate",
    label: "Immediately",
    description: "Receive updates in real time.",
  },
  {
    value: "daily",
    label: "Daily digest",
    description: "Receive one summary of the day's activity at 6:00 PM.",
  },
  {
    value: "weekly",
    label: "Weekly digest",
    description: "Receive one summary of the week's activity every Friday at 6:00 PM.",
  },
];

const normalizeSchedule = (value: unknown): Schedule => {
  if (value === "daily" || value === "weekly" || value === "immediate") return value;
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
        const prefs = data as { client_needs_schedule?: string | null };
        // Timing only — channel toggles control category on/off. Backend still
        // mutes agents with client_needs_enabled/new_matches_enabled=false.
        setSchedule(normalizeSchedule(prefs.client_needs_schedule));
      }
    } catch (error) {
      console.error("Error fetching notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSchedule = async (nextValue: string) => {
    const next = normalizeSchedule(nextValue);
    if (next === schedule) return;
    const previous = schedule;
    setSchedule(next);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Timing changes MUST only write client_needs_schedule. Do not touch
      // client_needs_enabled or new_matches_enabled — those are channel
      // enable flags owned by other surfaces; changing cadence should never
      // silently un-mute a previously muted agent.
      const { error } = await supabase.from("notification_preferences").upsert(
        {
          user_id: user.id,
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
    <NotificationFrequencyCards
      value={schedule}
      onChange={updateSchedule}
      options={scheduleOptions}
      title="Notification timing"
      description="Choose when you receive email about Comms Center activity. Channel toggles below control which categories you get."
    />
  );
};
