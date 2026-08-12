import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Users, TrendingUp, Home, MessageSquare } from "lucide-react";
import { SendMessageDialog } from "./SendMessageDialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ALL_CHANNELS_OFF,
  channelStateFromRow,
  muteAllChannels,
  toggleChannel,
  type CommsChannelState,
} from "@/lib/commsChannelPrefs";


/** Native control — avoids any global `Button` / primary styles bleeding onto channel Send. */
const channelSendClassName =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-800 shadow-none transition-colors hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const channelCard =
  "cursor-pointer rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow] duration-150 hover:shadow-md";

type NotificationPreferences = CommsChannelState;

type NotificationPreferenceCardsProps = {
  onPreferencesChange?: () => void;
  onMuteAllStateChange?: (state: { anyEnabled: boolean; muteAll: () => void } | null) => void;
};

export const NotificationPreferenceCards = ({ onPreferencesChange, onMuteAllStateChange }: NotificationPreferenceCardsProps = {}) => {
  // Opt-in policy (Aug 2026): everything is OFF until the agent explicitly
  // enables a channel. A missing notification_preferences row and null
  // category values both render as OFF — never ON.
  const [preferences, setPreferences] = useState<NotificationPreferences>({ ...ALL_CHANNELS_OFF });
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState<{
    open: boolean;
    category: keyof NotificationPreferences | null;
    title: string;
  }>({ open: false, category: null, title: "" });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
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

      setPreferences(channelStateFromRow(data as any));
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = async (key: keyof NotificationPreferences) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Master switches follow the categories: any category on ⇒ both masters
      // true, so enabling the first channel is a complete, usable opt-in.
      // All categories off ⇒ both masters false. Other explicit selections
      // are preserved.
      const upsertRow = toggleChannel(preferences, key);
      const { client_needs_enabled: _c, new_matches_enabled: _n, ...newPreferences } =
        upsertRow;

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...upsertRow,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setPreferences(newPreferences);
      // Mark preferences as explicitly set by the agent so default-on logic
      // and the default-notice banner stop applying.
      try {
        await supabase
          .from("agent_settings")
          .update({ preferences_set: true })
          .eq("user_id", user.id);
      } catch (e) {
        console.warn("[NotificationPreferenceCards] preferences_set update skipped:", e);
      }
      onPreferencesChange?.();
    } catch (error) {
      console.error("Error updating preferences:", error);
    }
  };

  const deselectAllPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const upsertRow = muteAllChannels();
      const { client_needs_enabled: _c, new_matches_enabled: _n, ...newPreferences } =
        upsertRow;

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...upsertRow,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setPreferences(newPreferences);
      try {
        await supabase
          .from("agent_settings")
          .update({ preferences_set: true })
          .eq("user_id", user.id);
      } catch (e) {
        console.warn("[NotificationPreferenceCards] preferences_set update skipped:", e);
      }
      onPreferencesChange?.();
    } catch (error) {
      console.error("Error updating preferences:", error);
    }
  };

  const cards = [
    {
      key: "buyer_need" as keyof NotificationPreferences,
      title: "Buyer Needs",
      description: "Active buyer requests",
      active: preferences.buyer_need,
      icon: Users,
    },
    {
      key: "sales_intel" as keyof NotificationPreferences,
      title: "Sales Intel",
      description: "Market activity & insights",
      active: preferences.sales_intel,
      icon: TrendingUp,
    },
    {
      key: "renter_need" as keyof NotificationPreferences,
      title: "Renter Needs",
      description: "Active rental requests",
      active: preferences.renter_need,
      icon: Home,
    },
    {
      key: "general_discussion" as keyof NotificationPreferences,
      title: "General Discussions",
      description: "Referrals & agent conversation",
      active: preferences.general_discussion,
      icon: MessageSquare,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 shrink-0 rounded-md bg-neutral-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-28 rounded-md bg-neutral-100" />
                <Skeleton className="h-3 w-40 rounded-md bg-neutral-100" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Skeleton className="h-8 w-20 rounded-full bg-neutral-100" />
              <Skeleton className="h-6 w-24 rounded-full bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const anyEnabled = Object.values(preferences).some(v => v);

  const openCompose = (category: keyof NotificationPreferences, title: string) => {
    setOpenDialog({ open: true, category, title });
  };

  return (
    <>
      <div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3">
          {cards.map((card) => {
            const IconComponent = card.icon;
            return (
              <div
                key={card.key}
                className={channelCard}
                onClick={() => openCompose(card.key, card.title)}
              >
                {/* Top row: Icon + Title + Description */}
                <div className="flex items-start gap-3 [&_svg]:!text-[#16A34A]">
                  <IconComponent className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[15px] font-semibold text-neutral-900">{card.title}</h4>
                    <p className="text-sm text-neutral-500">{card.description}</p>
                  </div>
                </div>
                
                {/* Bottom row: Send + Active/Muted toggle */}
                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    className={channelSendClassName}
                    onClick={(e) => {
                      e.stopPropagation();
                      openCompose(card.key, card.title);
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 !text-neutral-700" strokeWidth={2} aria-hidden />
                      Create new
                    </span>
                  </button>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          card.active ? "!bg-[#16A34A]" : "!bg-neutral-400",
                        )}
                      />
                      <span className="text-xs font-medium !text-neutral-600">
                        {card.active ? "On" : "Off"}
                      </span>
                    </div>
                    <Switch
                      id={`receive-${card.key}`}
                      checked={card.active}
                      onCheckedChange={() => togglePreference(card.key)}
                      className="data-[state=checked]:!bg-[#0E56F5] data-[state=unchecked]:!bg-neutral-200 focus-visible:ring-[#0E56F5]/25"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* "Mute all" lives in the Channels heading in the parent page now. */}
      </div>

      {openDialog.category && (
        <SendMessageDialog
          open={openDialog.open}
          onOpenChange={(open) => setOpenDialog({ open, category: null, title: "" })}
          category={openDialog.category}
          categoryTitle={openDialog.title}
          defaultSubject={openDialog.title}
        />
      )}
    </>
  );
};
