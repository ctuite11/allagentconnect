import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { NotificationPreferenceCards } from "@/components/NotificationPreferenceCards";
import { ClientNeedsNotificationSettings } from "@/components/ClientNeedsNotificationSettings";
import GeographicPreferencesManager from "@/components/GeographicPreferencesManager";
import PriceRangePreferences from "@/components/PriceRangePreferences";
import PropertyTypePreferences from "@/components/PropertyTypePreferences";

const ClientNeedsDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-6 pt-20">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Connect . Communicate . Collaborate</h1>
          <p className="text-lg text-muted-foreground mb-4">Turning relationships into results</p>
          <p className="text-base text-muted-foreground max-w-3xl">
            Share your active client needs and receive targeted matches from other agents. Customize your alerts by market and property type for insider-level visibility.
          </p>
        </div>

        {/* Notification Preference Cards */}
        <NotificationPreferenceCards />

        {/* Separator */}
        <Separator className="my-8" />

        {/* My Preferences Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">
            My Preferences{" "}
            <span className="text-xs font-normal text-muted-foreground">(For receiving email notifications only)</span>
          </h2>
          <div className="space-y-6 mt-6">
            <PriceRangePreferences agentId={user?.id || ""} />
            <PropertyTypePreferences agentId={user?.id || ""} />
            <GeographicPreferencesManager agentId={user?.id || ""} />
          </div>
        </div>

        {/* Notification Settings - Required (Final Step) */}
        <ClientNeedsNotificationSettings />
      </div>
    </div>
  );
};

export default ClientNeedsDashboard;
