import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Send, Users, TrendingUp, Home, MessageSquare } from "lucide-react";
import { SendMessageDialog } from "./SendMessageDialog";

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
      title: "Buyer Need",
      description: "Get notified about buyer needs in your market",
      active: preferences.buyer_need,
      icon: Users,
    },
    {
      key: "sales_intel" as keyof NotificationPreferences,
      title: "Sales Intel",
      description: "Receive updates on sales and market intelligence",
      active: preferences.sales_intel,
      icon: TrendingUp,
    },
    {
      key: "renter_need" as keyof NotificationPreferences,
      title: "Renter Need",
      description: "Stay informed about renter needs",
      active: preferences.renter_need,
      icon: Home,
    },
    {
      key: "general_discussion" as keyof NotificationPreferences,
      title: "General Discussion",
      description: "Connect for referrals, recommendations, and advice",
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
              className="h-[120px] rounded-xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const anyEnabled = Object.values(preferences).some(v => v);

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => {
            const IconComponent = card.icon;
            return (
              <Card
                key={card.key}
                className={`border transition-all ${
                  card.active 
                    ? "border-primary bg-muted/30" 
                    : "border-border"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Icon + Title + Description */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        card.active ? "bg-primary/10" : "bg-muted"
                      }`}>
                        <IconComponent className={`h-5 w-5 ${card.active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-foreground">{card.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{card.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom: Actions */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    {/* Send Button - Secondary */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDialog({ open: true, category: card.key, title: card.title });
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Send
                    </Button>

                    {/* Receiving Toggle */}
                    <div className="flex items-center gap-2">
                      <Label 
                        htmlFor={`receive-${card.key}`} 
                        className={`text-xs cursor-pointer ${card.active ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        Receiving
                      </Label>
                      <Switch
                        id={`receive-${card.key}`}
                        checked={card.active}
                        onCheckedChange={() => togglePreference(card.key)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bulk action - subtle ghost button aligned right */}
        {anyEnabled && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={deselectAllPreferences}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Deselect All Notifications
            </Button>
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
