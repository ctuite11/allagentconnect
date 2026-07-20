import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

type Frequency = "immediate" | "daily" | "weekly";

interface NotificationSettings {
  frequency: Frequency;
}

const OPTIONS: { value: Frequency; label: string; description: string }[] = [
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

const cardShell =
  "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md";

function normalizeFrequency(raw: unknown): Frequency {
  if (raw === "daily" || raw === "weekly" || raw === "immediate") return raw;
  return "immediate";
}

export const ClientNeedsNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>({ frequency: "immediate" });
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
        // Timing only — channel toggles control category on/off. Prior "Off"
        // users (new_matches_enabled=false) still load as immediate in the UI;
        // backend continues to mute them until they re-enable channels/timing.
        setSettings({ frequency: normalizeFrequency(prefs.client_needs_schedule) });
      }
    } catch (error) {
      console.error("Error fetching notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: NotificationSettings) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("notification_preferences").upsert(
        {
          user_id: user.id,
          client_needs_schedule: newSettings.frequency,
          client_needs_enabled: true,
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      setSettings(newSettings);
    } catch (error) {
      console.error("Error updating notification settings:", error);
    }
  };

  const handleFrequencyChange = (value: string) => {
    updateSettings({ frequency: value as Frequency });
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
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg bg-neutral-100" />
            ))}
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
          <CardTitle className="text-base font-semibold text-neutral-900">Communications notifications</CardTitle>
        </div>
        <p className="text-[13px] leading-relaxed text-neutral-500">
          Chooses when you receive email about Comms Center activity. Channel toggles below control
          which categories you get.
        </p>
      </CardHeader>
      <CardContent className="mt-4 space-y-1 p-0">
        <RadioGroup value={settings.frequency} onValueChange={handleFrequencyChange} className="space-y-1">
          {OPTIONS.map((opt) => {
            const active = settings.frequency === opt.value;
            return (
              <div
                key={opt.value}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                  active
                    ? "border-neutral-200 bg-white shadow-sm"
                    : "border-transparent hover:bg-neutral-50/80",
                )}
              >
                <RadioGroupItem value={opt.value} id={`comms-notif-${opt.value}`} className="mt-0.5" />
                <Label
                  htmlFor={`comms-notif-${opt.value}`}
                  className={cn(
                    "cursor-pointer text-[13px] leading-snug",
                    active ? "font-medium text-neutral-900" : "font-normal text-neutral-600",
                  )}
                >
                  <span className="block">{opt.label}</span>
                  <span className="mt-0.5 block text-xs font-normal leading-snug text-neutral-500">
                    {opt.description}
                  </span>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};
