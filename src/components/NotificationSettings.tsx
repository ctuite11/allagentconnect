import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Bell, Check } from "lucide-react";
import { toast } from "sonner";

const NotificationSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPreferences(data);
      } else {
        // Create default preferences
        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            new_matches_enabled: true,
            price_changes_enabled: true,
            frequency: 'immediate',
          })
          .select()
          .single();

        if (createError) throw createError;
        setPreferences(newPrefs);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('notification_preferences')
        .update({
          new_matches_enabled: preferences.new_matches_enabled,
          price_changes_enabled: preferences.price_changes_enabled,
          frequency: preferences.frequency,
        })
        .eq('id', preferences.id);

      if (error) throw error;

      toast.success('Notification settings saved');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="aac-card border border-neutral-200">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="aac-card border border-neutral-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-muted-foreground" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Manage how you receive updates about properties
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New Matches */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="new-matches" className="text-base">
              New Property Matches
            </Label>
            <p className="text-sm text-muted-foreground">
              Get notified when new properties match your saved searches
            </p>
          </div>
          <Switch
            id="new-matches"
            checked={preferences?.new_matches_enabled || false}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, new_matches_enabled: checked })
            }
          />
        </div>

        {/* Price Changes */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="price-changes" className="text-base">
              Price Changes
            </Label>
            <p className="text-sm text-muted-foreground">
              Get notified when prices change on your saved homes
            </p>
          </div>
          <Switch
            id="price-changes"
            checked={preferences?.price_changes_enabled || false}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, price_changes_enabled: checked })
            }
          />
        </div>

        {/* Frequency */}
        <div className="space-y-2">
          <Label>Notification Frequency</Label>
          <Select
            value={preferences?.frequency || 'immediate'}
            onValueChange={(value) =>
              setPreferences({ ...preferences, frequency: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">
                Immediate (as they happen)
              </SelectItem>
              <SelectItem value="daily">
                Daily Digest
              </SelectItem>
              <SelectItem value="weekly">
                Weekly Summary
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Choose how often you want to receive email notifications
          </p>
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;