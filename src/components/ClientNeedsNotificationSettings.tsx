import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Check } from "lucide-react";

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
      toast.success("Notification settings updated");
    } catch (error) {
      console.error("Error updating notification settings:", error);
      toast.error("Failed to update notification settings");
    }
  };

  const handleScheduleChange = (value: string) => {
    updateSettings({ ...settings, schedule: value as "immediate" | "daily" | "weekly" });
  };

  const handleCompleteSetup = () => {
    toast.success("Setup complete! You'll receive notifications based on your preferences.");
  };

  if (loading) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-primary mb-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>Notification Settings</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Schedule */}
        <div className="space-y-3">
          <Label className="text-base font-medium">
            How often would you like to receive notifications?
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

        {/* Complete Setup Button */}
        <div className="pt-4">
          <Button 
            onClick={handleCompleteSetup}
            className="w-full"
            size="lg"
          >
            <Check className="mr-2 h-4 w-4" />
            Complete Your Setup
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
