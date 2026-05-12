import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const settingsCard =
  "rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]";

const NotificationSettings = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoadError(false);
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPreferences(null);
        return;
      }

      const { data, error } = await supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setPreferences(data);
      } else {
        const { data: newPrefs, error: createError } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: user.id,
            new_matches_enabled: true,
            price_changes_enabled: true,
            frequency: "immediate",
          })
          .select()
          .single();

        if (createError) throw createError;
        setPreferences(newPrefs);
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      setLoadError(true);
      toast.error("Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

  const handleSave = async () => {
    if (!preferences?.id) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("notification_preferences")
        .update({
          new_matches_enabled: preferences.new_matches_enabled,
          price_changes_enabled: preferences.price_changes_enabled,
          frequency: preferences.frequency,
        })
        .eq("id", preferences.id);

      if (error) throw error;

      toast.success("Notification settings saved");
    } catch (error) {
      console.error("Error saving notification preferences:", error);
      toast.error("Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className={cn(settingsCard)}>
        <CardHeader className="space-y-2 pb-2">
          <Skeleton className="h-6 w-[min(100%,240px)] rounded-md bg-neutral-100" />
          <Skeleton className="h-4 w-[min(100%,320px)] rounded-md bg-neutral-100" />
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-6 last:border-0">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 rounded-md bg-neutral-100" />
                <Skeleton className="h-3 w-full max-w-sm rounded-md bg-neutral-100" />
              </div>
              <Skeleton className="h-6 w-11 shrink-0 rounded-full bg-neutral-100" />
            </div>
          ))}
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 rounded-md bg-neutral-100" />
            <Skeleton className="h-10 w-full max-w-md rounded-md bg-neutral-100" />
            <Skeleton className="h-3 w-full max-w-lg rounded-md bg-neutral-100" />
          </div>
          <Skeleton className="h-10 w-[140px] rounded-md bg-neutral-100" />
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className={cn(settingsCard)}>
        <CardContent className="py-10 text-center">
          <p className="text-[15px] font-semibold text-neutral-900">Couldn&apos;t load settings</p>
          <p className="mt-1 text-[13px] text-neutral-500">Check your connection and try again.</p>
          <Button type="button" size="sm" className="mt-5" onClick={() => void fetchPreferences()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card className={cn(settingsCard)}>
        <CardContent className="py-10 text-center">
          <p className="text-[13px] text-neutral-600">Sign in to manage email notifications.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(settingsCard)}>
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <Bell className="h-5 w-5 text-neutral-600" aria-hidden />
          Email notifications
        </CardTitle>
        <CardDescription className="text-[13px] leading-relaxed text-neutral-500">
          Manage how you receive updates about properties
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-6">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="new-matches" className="text-[15px] font-medium text-neutral-900">
              New property matches
            </Label>
            <p className="text-[13px] leading-snug text-neutral-500">
              Get notified when new properties match your saved searches
            </p>
          </div>
          <Switch
            id="new-matches"
            checked={preferences.new_matches_enabled || false}
            onCheckedChange={(checked) => setPreferences({ ...preferences, new_matches_enabled: checked })}
            className="shrink-0 data-[state=checked]:bg-neutral-700"
          />
        </div>

        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-6">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="price-changes" className="text-[15px] font-medium text-neutral-900">
              Price changes
            </Label>
            <p className="text-[13px] leading-snug text-neutral-500">
              Get notified when prices change on your saved homes
            </p>
          </div>
          <Switch
            id="price-changes"
            checked={preferences.price_changes_enabled || false}
            onCheckedChange={(checked) => setPreferences({ ...preferences, price_changes_enabled: checked })}
            className="shrink-0 data-[state=checked]:bg-neutral-700"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[13px] font-medium text-neutral-800">Notification frequency</Label>
          <Select
            value={preferences.frequency || "immediate"}
            onValueChange={(value) => setPreferences({ ...preferences, frequency: value })}
          >
            <SelectTrigger className="max-w-md border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:ring-neutral-300/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg border-neutral-200 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
              <SelectItem value="immediate">Immediate (as they happen)</SelectItem>
              <SelectItem value="daily">Daily digest</SelectItem>
              <SelectItem value="weekly">Weekly summary</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[13px] text-neutral-500">Choose how often you want to receive email notifications</p>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
