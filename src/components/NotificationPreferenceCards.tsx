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
    },
    {
      key: "sales_intel" as keyof NotificationPreferences,
      title: "Sales Intel",
      description: "Receive updates on sales and market intelligence",
      icon: TrendingUp,
      active: preferences.sales_intel,
    },
    {
      key: "renter_need" as keyof NotificationPreferences,
      title: "Renter Need",
      description: "Stay informed about rental opportunities",
      icon: Building2,
      active: preferences.renter_need,
    },
    {
      key: "general_discussion" as keyof NotificationPreferences,
      title: "General Discussion",
      description: "Connect for referrals, recommendations, and advice",
      icon: MessageSquare,
      active: preferences.general_discussion,
    },
  ];

  if (loading) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-4">Choose Your Notification Preferences</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => {
            const Icon = card.icon;
            const edgeClass = card.key === 'buyer_need'
              ? 'before:bg-primary'
              : card.key === 'sales_intel'
              ? 'before:bg-accent'
              : card.key === 'renter_need'
              ? 'before:bg-secondary'
              : 'before:bg-accent';
          return (
            <Card
              key={card.key}
              className={`relative overflow-hidden transition-all hover:shadow-lg cursor-pointer before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:content-[''] ${edgeClass} ${
                card.active ? "border-primary border-2" : ""
              }`}
              onClick={() => togglePreference(card.key)}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={`p-4 rounded-full ${
                    card.active ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <Icon className={`h-8 w-8 ${
                      card.active ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-semibold">{card.title}</h4>
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                  </div>
                  <Button
                    variant={card.active ? "default" : "outline"}
                    className="w-full gap-2"
                  >
                    {card.active && <Check className="h-4 w-4" />}
                    {card.active ? "Notifications On" : "Turn On Notifications"}
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
