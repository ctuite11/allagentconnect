import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Home, TrendingUp, Building2, MessageSquare, Check } from "lucide-react";

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
        });

      if (error) throw error;

      setPreferences(newPreferences);
      toast.success(`${newValue ? "Enabled" : "Disabled"} notifications`);
    } catch (error) {
      console.error("Error updating preferences:", error);
      toast.error("Failed to update preferences");
    }
  };

  const cards = [
    {
      key: "buyer_need" as keyof NotificationPreferences,
      title: "Buyer Need",
      description: "Get notified about buyer needs in your market",
      icon: Home,
      active: preferences.buyer_need,
      borderColor: "border-l-primary",
      iconBgColor: "bg-primary/20",
      iconColor: "text-primary",
    },
    {
      key: "sales_intel" as keyof NotificationPreferences,
      title: "Sales Intel",
      description: "Receive updates on sales and market intelligence",
      icon: TrendingUp,
      active: preferences.sales_intel,
      borderColor: "border-l-accent",
      iconBgColor: "bg-accent/10",
      iconColor: "text-accent",
    },
    {
      key: "renter_need" as keyof NotificationPreferences,
      title: "Renter Need",
      description: "Stay informed about rental opportunities",
      icon: Building2,
      active: preferences.renter_need,
      borderColor: "border-l-purple-500",
      iconBgColor: "bg-purple-500/10",
      iconColor: "text-purple-500",
    },
    {
      key: "general_discussion" as keyof NotificationPreferences,
      title: "General Discussion",
      description: "Connect for referrals, recommendations, and advice",
      icon: MessageSquare,
      active: preferences.general_discussion,
      borderColor: "border-l-red-500",
      iconBgColor: "bg-red-500/10",
      iconColor: "text-red-500",
    },
  ];

  if (loading) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-4">Choose Your Notification Preferences</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => {
            const Icon = card.icon;
            return (
            <Card
              key={card.key}
              className={`border-l-4 ${card.borderColor} transition-all hover:shadow-lg cursor-pointer`}
            >
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-base font-semibold mb-1">{card.title}</h4>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </div>
                  <div className={`ml-4 h-12 w-12 rounded-full ${card.iconBgColor} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-6 w-6 ${card.iconColor}`} />
                  </div>
                </div>
                <div className="mt-auto">
                  <Button
                    variant={card.active ? "default" : "outline"}
                    size="sm"
                    className="gap-1 h-8 text-xs px-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePreference(card.key);
                    }}
                  >
                    {card.active && <Check className="h-3 w-3" />}
                    {card.active ? "On" : "Off"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
