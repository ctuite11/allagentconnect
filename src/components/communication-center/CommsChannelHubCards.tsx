import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { SendMessageDialog } from "@/components/SendMessageDialog";
import { CommsChannelHubCard } from "@/components/communication-center/CommsChannelHubCard";
import { COMMS_CHANNELS } from "@/lib/commsChannels";
import type { CommsChannelKey } from "@/lib/commsChannelPrefs";
import {
  ALL_CHANNELS_OFF,
  channelStateFromRow,
  muteAllChannels,
  toggleChannel,
  type CommsChannelState,
} from "@/lib/commsChannelPrefs";
import { fetchLatestReceivedPreview, type LatestReceivedPreview } from "@/lib/commsChannelPreview";

type CommsChannelHubCardsProps = {
  onPreferencesChange?: () => void;
  onMuteAllStateChange?: (state: { anyEnabled: boolean; muteAll: () => void } | null) => void;
};

type PreviewState = Record<CommsChannelKey, LatestReceivedPreview | null>;

const EMPTY_PREVIEWS: PreviewState = {
  buyer_need: null,
  sales_intel: null,
  renter_need: null,
  general_discussion: null,
};

export function CommsChannelHubCards({
  onPreferencesChange,
  onMuteAllStateChange,
}: CommsChannelHubCardsProps) {
  const [preferences, setPreferences] = useState<CommsChannelState>({ ...ALL_CHANNELS_OFF });
  const [previews, setPreviews] = useState<PreviewState>(EMPTY_PREVIEWS);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [previewsLoading, setPreviewsLoading] = useState(true);
  const [compose, setCompose] = useState<{
    open: boolean;
    category: CommsChannelKey;
    title: string;
  }>({ open: false, category: "buyer_need", title: "Buyer Needs" });

  const loadPreviews = useCallback(async () => {
    setPreviewsLoading(true);
    const entries = await Promise.all(
      COMMS_CHANNELS.map(async (channel) => {
        const preview = await fetchLatestReceivedPreview(channel.key);
        return [channel.key, preview] as const;
      }),
    );
    setPreviews(Object.fromEntries(entries) as PreviewState);
    setPreviewsLoading(false);
  }, []);

  const fetchPreferences = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setPreferences(channelStateFromRow(data as Record<string, unknown> | null));
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPreferences();
    void loadPreviews();
  }, [fetchPreferences, loadPreviews]);

  const deselectAllPreferences = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const upsertRow = muteAllChannels();
      const { client_needs_enabled: _c, new_matches_enabled: _n, ...newPreferences } = upsertRow;

      const { error } = await supabase.from("notification_preferences").upsert(
        { user_id: user.id, ...upsertRow },
        { onConflict: "user_id" },
      );
      if (error) throw error;

      setPreferences(newPreferences);
      try {
        await supabase.from("agent_settings").update({ preferences_set: true }).eq("user_id", user.id);
      } catch (e) {
        console.warn("[CommsChannelHubCards] preferences_set update skipped:", e);
      }
      onPreferencesChange?.();
    } catch (error) {
      console.error("Error muting channels:", error);
    }
  }, [onPreferencesChange]);

  useEffect(() => {
    if (prefsLoading) return;
    onMuteAllStateChange?.({
      anyEnabled: Object.values(preferences).some((v) => v),
      muteAll: deselectAllPreferences,
    });
  }, [preferences, prefsLoading, onMuteAllStateChange, deselectAllPreferences]);

  const togglePreference = async (key: CommsChannelKey) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const upsertRow = toggleChannel(preferences, key);
      const { client_needs_enabled: _c, new_matches_enabled: _n, ...newPreferences } = upsertRow;

      const { error } = await supabase.from("notification_preferences").upsert(
        { user_id: user.id, ...upsertRow },
        { onConflict: "user_id" },
      );
      if (error) throw error;

      setPreferences(newPreferences);
      try {
        await supabase.from("agent_settings").update({ preferences_set: true }).eq("user_id", user.id);
      } catch (e) {
        console.warn("[CommsChannelHubCards] preferences_set update skipped:", e);
      }
      onPreferencesChange?.();
    } catch (error) {
      console.error("Error updating preferences:", error);
    }
  };

  const openCompose = (category: CommsChannelKey, title: string) => {
    setCompose({ open: true, category, title });
  };

  if (prefsLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-5 w-32 rounded bg-neutral-100" />
            <Skeleton className="mt-2 h-4 w-full rounded bg-neutral-100" />
            <Skeleton className="mt-6 h-24 w-full rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {COMMS_CHANNELS.map((channel) => (
          <CommsChannelHubCard
            key={channel.key}
            channel={channel}
            preview={previews[channel.key]}
            loading={previewsLoading}
            channelOn={preferences[channel.key]}
            onToggleChannel={() => void togglePreference(channel.key)}
            onSend={() => openCompose(channel.key, channel.title)}
          />
        ))}
      </div>

      <SendMessageDialog
        open={compose.open}
        onOpenChange={(open) => setCompose((c) => ({ ...c, open }))}
        category={compose.category}
        categoryTitle={compose.title}
        defaultSubject={compose.title}
      />
    </>
  );
}
