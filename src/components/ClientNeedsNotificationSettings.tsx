import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotificationSettings {
  enabled: boolean;
  schedule: "immediate" | "daily" | "weekly";
}

export const ClientNeedsNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
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
          enabled: prefs.client_needs_enabled ?? true,
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
          client_needs_enabled: newSettings.enabled,
          client_needs_schedule: newSettings.schedule,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setSettings(newSettings);
      setHasInitialSelection(true);
      toast.success("Notification settings updated");
    } catch (error) {
      console.error("Error updating notification settings:", error);
      toast.error("Failed to update notification settings");
    }
  };

  const handleEnabledChange = (checked: boolean) => {
    updateSettings({ ...settings, enabled: checked });
  };

  const handleScheduleChange = (value: string) => {
    updateSettings({ ...settings, schedule: value as "immediate" | "daily" | "weekly" });
  };

  if (loading) {
    return null;
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Notifications */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="notifications-enabled"
            checked={settings.enabled}
            onCheckedChange={handleEnabledChange}
          />
          <Label
            htmlFor="notifications-enabled"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Send notifications to me (agent)
          </Label>
        </div>

        {/* Notification Schedule - Required */}
        <div className="space-y-3">
          <Label className="text-base font-medium">
            Notification Schedule
          </Label>
          <RadioGroup
            value={settings.schedule}
            onValueChange={handleScheduleChange}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="immediate" id="immediate" />
              <Label htmlFor="immediate" className="cursor-pointer font-normal">
                Immediately - Get alerts as soon as your preferences match
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="daily" id="daily" />
              <Label htmlFor="daily" className="cursor-pointer font-normal">
                Daily - Receive a daily digest of new matches
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="weekly" id="weekly" />
              <Label htmlFor="weekly" className="cursor-pointer font-normal">
                Weekly - Receive a weekly summary of new matches
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};
