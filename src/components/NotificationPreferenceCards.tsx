import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Send, Users, TrendingUp, Home, MessageSquare } from "lucide-react";
import { SendMessageDialog } from "./SendMessageDialog";
import { NeutralSwitch } from "@/components/ui/neutral-switch";
import { aacStyles } from "@/ui/aacStyles";

interface NotificationPreferences {
  buyer_need: boolean;
  sales_intel: boolean;
  renter_need: boolean;
  general_discussion: boolean;
}

export const NotificationPreferenceCards = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    buyer_need: false,
    sales_intel: false,
    renter_need: false,
    general_discussion: false,
  });
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

      if (data) {
        setPreferences({
          buyer_need: (data as any).buyer_need ?? false,
          sales_intel: (data as any).sales_intel ?? false,
          renter_need: (data as any).renter_need ?? false,
          general_discussion: (data as any).general_discussion ?? false,
        });
      }
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

      const newValue = !preferences[key];
      const newPreferences = { ...preferences, [key]: newValue };

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...newPreferences,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setPreferences(newPreferences);
    } catch (error) {
      console.error("Error updating preferences:", error);
    }
  };

  const deselectAllPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newPreferences = {
        buyer_need: false,
        sales_intel: false,
        renter_need: false,
        general_discussion: false,
      };

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...newPreferences,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setPreferences(newPreferences);
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
      title: "Discussion",
      description: "Referrals & agent conversation",
      active: preferences.general_discussion,
      icon: MessageSquare,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[120px] rounded-2xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const anyEnabled = Object.values(preferences).some(v => v);

  return (
    <>
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => {
            const IconComponent = card.icon;
            return (
              <div
                key={card.key}
                className={aacStyles.card}
              >
                {/* Top row: Icon + Title + Description */}
                <div className="flex items-start gap-3">
                  <IconComponent className={aacStyles.iconGreen} />
                  <div className="min-w-0 flex-1">
                    <h4 className={aacStyles.cardTitle}>{card.title}</h4>
                    <p className={aacStyles.cardDesc}>{card.description}</p>
                  </div>
                </div>
                
                {/* Bottom row: Send + Active/Muted toggle */}
                <div className="flex items-center justify-between mt-4">
                  <button
                    className={aacStyles.neutralButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDialog({ open: true, category: card.key, title: card.title });
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={card.active ? "h-2 w-2 rounded-full bg-emerald-500" : "h-2 w-2 rounded-full bg-slate-300"} />
                      <span className={card.active ? "text-slate-700 text-xs" : "text-slate-500 text-xs"}>
                        {card.active ? "Active" : "Muted"}
                      </span>
                    </div>
                    <NeutralSwitch
                      id={`receive-${card.key}`}
                      checked={card.active}
                      onCheckedChange={() => togglePreference(card.key)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bulk action aligned right */}
        {anyEnabled && (
          <div className="flex justify-end mt-4">
            <button
              onClick={deselectAllPreferences}
              className={aacStyles.ghostButton}
            >
              Mute All
            </button>
          </div>
        )}
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
