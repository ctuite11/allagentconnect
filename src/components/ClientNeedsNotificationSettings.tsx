import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";

interface NotificationSettings {
  schedule: "immediate" | "daily" | "weekly";
}

export const ClientNeedsNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    schedule: "immediate",
  });
  const [loading, setLoading] = useState(true);
  const [hasInitialSelection, setHasInitialSelection] = useState(false);

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

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        const prefs = data as any;
        setSettings({
          schedule: (prefs.client_needs_schedule ?? "immediate") as "immediate" | "daily" | "weekly",
        });
        setHasInitialSelection(true);
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

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          client_needs_enabled: true,
          client_needs_schedule: newSettings.schedule,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setSettings(newSettings);
      setHasInitialSelection(true);
    } catch (error) {
      console.error("Error updating notification settings:", error);
    }
  };

  const handleScheduleChange = (value: string) => {
    updateSettings({ ...settings, schedule: value as "immediate" | "daily" | "weekly" });
  };

  if (loading) {
    return (
      <div className="mb-8">
        <div className="h-32 rounded-2xl border border-neutral-200 bg-white animate-pulse" />
      </div>
    );
  }

  return (
    <Card className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <CardHeader className="p-0">
        <div className="flex items-center gap-1.5">
          <Bell className="h-6 w-6 text-emerald-600" />
          <CardTitle className="text-base font-medium text-zinc-900">Email Frequency</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        {/* Notification Schedule */}
        <div className="space-y-3">
          <Label className="text-sm text-zinc-500">
            How often would you like to receive notifications?
          </Label>
          <RadioGroup
            value={settings.schedule}
            onValueChange={handleScheduleChange}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="immediate" id="immediate" />
              <Label htmlFor="immediate" className="cursor-pointer text-sm text-zinc-700">
                Immediately - Get alerts as soon as your preferences match
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="daily" id="daily" />
              <Label htmlFor="daily" className="cursor-pointer text-sm text-zinc-700">
                Daily - Receive a daily digest of new matches
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="weekly" id="weekly" />
              <Label htmlFor="weekly" className="cursor-pointer text-sm text-zinc-700">
                Weekly - Receive a weekly summary of new matches
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};
