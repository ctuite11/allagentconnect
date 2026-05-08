import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";

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
    label: "Daily Digest",
    description: "One daily summary of agent-network communications activity and updates",
  },
  {
    value: "weekly",
    label: "Weekly Digest",
    description: "One weekly summary of agent-network communications activity and updates",
  },
  {
    value: "off",
    label: "Off",
    description: "Don't email me Communications Center or network workflow alerts",
  },
];

export const ClientNeedsNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>({ frequency: "immediate" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        const prefs = data as any;
        // If master gate is off → "off"; otherwise use the schedule
        const frequency: Frequency = prefs.new_matches_enabled === false
          ? "off"
          : ((prefs.client_needs_schedule ?? "immediate") as Frequency);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isOff = newSettings.frequency === "off";
      const payload: any = {
        user_id: user.id,
        client_needs_enabled: !isOff,
        new_matches_enabled: !isOff,
      };
      // Only persist schedule when not off; preserve last cadence otherwise
      if (!isOff) {
        payload.client_needs_schedule = newSettings.frequency;
      }

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(payload, { onConflict: "user_id" });

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
        <div className="h-32 rounded-2xl border border-neutral-200 bg-white animate-pulse" />
      </div>
    );
  }

  return (
    <Card className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <CardHeader className="p-0">
        <div className="flex items-center gap-1.5">
          <Bell className="h-5 w-5 text-emerald-600/80" />
          <CardTitle className="text-base font-medium text-zinc-900">Communications Notifications</CardTitle>
        </div>
        <p className="text-sm text-zinc-500 mt-1">
          Chooses cadence for email about Comms Center activity: outbound communications, network sends, and agent-network updates.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-0 mt-3">
        <RadioGroup
          value={settings.frequency}
          onValueChange={handleFrequencyChange}
          className="space-y-2"
        >
          {OPTIONS.map((opt) => {
            const active = settings.frequency === opt.value;
            return (
              <div
                key={opt.value}
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-zinc-50 ${active ? "bg-zinc-100" : ""}`}
              >
                <RadioGroupItem value={opt.value} id={`comms-notif-${opt.value}`} className="mt-0.5" />
                <Label
                  htmlFor={`comms-notif-${opt.value}`}
                  className={`cursor-pointer text-sm leading-snug ${active ? "font-medium text-zinc-900" : "text-zinc-700"}`}
                >
                  <span className="block">{opt.label}</span>
                  <span className="block text-xs text-zinc-500 font-normal">{opt.description}</span>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};
