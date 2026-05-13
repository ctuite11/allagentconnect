import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

type Frequency = "immediate" | "daily" | "weekly" | "off";

interface NotificationSettings {
  frequency: Frequency;
}

const OPTIONS: { value: Frequency; label: string; description: string }[] = [
  {
    value: "immediate",
    label: "Immediately",
    description:
      "Get an alert for outbound communications and high-signal network sends as communications activity happens",
  },
  {
    value: "daily",
    label: "Daily digest",
    description: "One daily summary of agent-network communications activity and updates",
  },
  {
    value: "weekly",
    label: "Weekly digest",
    description: "One weekly summary of agent-network communications activity and updates",
  },
  {
    value: "off",
    label: "Off",
    description: "Don't email me Communications Center or network workflow alerts",
  },
];

const cardShell =
  "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md";

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
        const prefs = data as any;
        const frequency: Frequency =
          prefs.new_matches_enabled === false ? "off" : ((prefs.client_needs_schedule ?? "immediate") as Frequency);
        setSettings({ frequency });
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

      const isOff = newSettings.frequency === "off";
      const payload: any = {
        user_id: user.id,
        client_needs_enabled: !isOff,
        new_matches_enabled: !isOff,
      };
      if (!isOff) {
        payload.client_needs_schedule = newSettings.frequency;
      }

      const { error } = await supabase.from("notification_preferences").upsert(payload, { onConflict: "user_id" });

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
            {[0, 1, 2, 3].map((i) => (
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
          Chooses cadence for email about Comms Center activity: outbound communications, network sends, and agent-network
          updates.
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
