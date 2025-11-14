import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Bell, Check } from "lucide-react";
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
      active: preferences.buyer_need,
      borderColor: "border-l-primary",
    },
    {
      key: "sales_intel" as keyof NotificationPreferences,
      title: "Sales Intel",
      description: "Receive updates on sales and market intelligence",
      active: preferences.sales_intel,
      borderColor: "border-l-accent",
    },
    {
      key: "renter_need" as keyof NotificationPreferences,
      title: "Renter Need",
      description: "Stay informed about renter needs",
      active: preferences.renter_need,
      borderColor: "border-l-purple-500",
    },
    {
      key: "general_discussion" as keyof NotificationPreferences,
      title: "General Discussion",
      description: "Connect for referrals, recommendations, and advice",
      active: preferences.general_discussion,
      borderColor: "border-l-red-500",
    },
  ];

  if (loading) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => {
              return (
              <Card
                key={card.key}
                className={`border-l-4 ${card.borderColor} transition-all hover:shadow-lg`}
              >
                <CardContent className="p-4 flex flex-col h-full min-h-[140px]">
                  <div className="mb-6">
                    <h4 className="text-base font-semibold mb-1">{card.title}</h4>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </div>
                  <div className="mt-auto flex justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-24 h-8 text-xs bg-background border-2 border-green-500/50 hover:bg-green-50 hover:border-green-500 dark:hover:bg-green-950 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDialog({ open: true, category: card.key, title: card.title });
                          }}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          <span>Send</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click here to send a message</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`w-24 h-8 text-xs border-2 transition-all ${
                            card.active 
                              ? "bg-primary border-primary text-primary-foreground hover:bg-primary/90" 
                              : "bg-background border-primary/50 hover:bg-primary/10 hover:border-primary"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePreference(card.key);
                          }}
                        >
                          {card.active ? (
                            <>
                              <Check className="h-4 w-4 mr-1 font-bold" />
                              <span>Receive</span>
                            </>
                          ) : (
                            <>
                              <Bell className="h-3 w-3 mr-1" />
                              <span>Receive</span>
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to {card.active ? "disable" : "enable"} receiving messages based on your selected preferences below</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {openDialog.category && (
        <SendMessageDialog
          open={openDialog.open}
          onOpenChange={(open) => setOpenDialog({ open, category: null, title: "" })}
          category={openDialog.category}
          categoryTitle={openDialog.title}
        />
      )}
    </TooltipProvider>
  );
};
