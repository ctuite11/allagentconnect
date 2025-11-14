import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell } from "lucide-react";

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
        .select("client_needs_enabled, client_needs_schedule")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings({
          enabled: data.client_needs_enabled ?? true,
          schedule: (data.client_needs_schedule ?? "immediate") as "immediate" | "daily" | "weekly",
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
    <Card className="border-l-4 border-l-primary mb-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>Notification Settings</CardTitle>
        </div>
        <CardDescription>
          Configure how you receive client need alerts
        </CardDescription>
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
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">
              Notification Schedule
              <span className="text-destructive ml-1">*</span>
            </Label>
            {!hasInitialSelection && (
              <span className="text-xs text-destructive">(Required selection)</span>
            )}
          </div>
          <RadioGroup
            value={settings.schedule}
            onValueChange={handleScheduleChange}
            className="space-y-3"
          >
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="immediate" id="immediate" className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="immediate" className="cursor-pointer font-medium">
                  Immediately
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get alerts as soon as matching client needs appear
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="daily" id="daily" className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="daily" className="cursor-pointer font-medium">
                  Daily
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive a daily digest of new matching client needs
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="weekly" id="weekly" className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="weekly" className="cursor-pointer font-medium">
                  Weekly
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive a weekly summary of new matching client needs
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};
