import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const cardShell =
  "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md";

export const ClientNeedsNotificationSettings = () => {
  const [enabled, setEnabled] = useState(true);
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
        // On unless either enabled boolean is explicitly false.
        const isOff = prefs.new_matches_enabled === false || prefs.client_needs_enabled === false;
        setEnabled(!isOff);
      }
      // No row → default On (matches DB defaults).
    } catch (error) {
      console.error("Error fetching notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateEnabled = async (nextEnabled: boolean) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Flip both enabled booleans together. Do NOT touch client_needs_schedule
      // so any historical daily/weekly cadence is preserved.
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: user.id,
            client_needs_enabled: nextEnabled,
            new_matches_enabled: nextEnabled,
          },
          { onConflict: "user_id" },
        );

      if (error) throw error;

      setEnabled(nextEnabled);

      // Mark preferences as explicitly set so the default-on notice stops.
      try {
        await supabase.from("agent_settings").update({ preferences_set: true }).eq("user_id", user.id);
      } catch (e) {
        console.warn("[ClientNeedsNotificationSettings] preferences_set update skipped:", e);
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
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
    <Card className={cn(cardShell)}>
      <CardHeader className="space-y-1 p-0">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 shrink-0 !text-[#16A34A]" strokeWidth={2} aria-hidden />
          <CardTitle className="text-base font-semibold text-neutral-900">Communications notifications</CardTitle>
        </div>
        <p className="text-[13px] leading-relaxed text-neutral-500">
          Email me about Comms Center activity: outbound communications, network sends, and agent-network updates.
        </p>
      </CardHeader>
      <CardContent className="mt-4 p-0">
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
          <Label htmlFor="comms-notifications-toggle" className="cursor-pointer text-[13px] font-medium text-neutral-900">
            Email me about Comms Center activity
          </Label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  enabled ? "!bg-[#16A34A]" : "!bg-neutral-400",
                )}
              />
              <span className="text-xs font-medium !text-neutral-600">{enabled ? "On" : "Off"}</span>
            </div>
            <Switch
              id="comms-notifications-toggle"
              checked={enabled}
              onCheckedChange={updateEnabled}
              className="data-[state=checked]:!bg-[#0E56F5] data-[state=unchecked]:!bg-neutral-200 focus-visible:ring-[#0E56F5]/25"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
