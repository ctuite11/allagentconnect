import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { NotificationPreferenceCards } from "@/components/NotificationPreferenceCards";
import { ClientNeedsNotificationSettings } from "@/components/ClientNeedsNotificationSettings";
import GeographicPreferencesManager from "@/components/GeographicPreferencesManager";
import PriceRangePreferences from "@/components/PriceRangePreferences";
import PropertyTypePreferences from "@/components/PropertyTypePreferences";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ClientNeedsDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [hasNotificationsEnabled, setHasNotificationsEnabled] = useState(false);
  const [hasFilters, setHasFilters] = useState(false);
  const [filtersLocallySet, setFiltersLocallySet] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user?.id) {
      checkPreferences();
    }
  }, [user]);

  // Show warning banner when notifications enabled without filters
  useEffect(() => {
    if (!preferencesLoaded) return;
    if (warningDismissed) return;

    if (!hasNotificationsEnabled) {
      setShowWarningBanner(false);
      return;
    }

    // Show banner only if notifications are on and no filters exist
    if (!(hasFilters || filtersLocallySet)) {
      setShowWarningBanner(true);
    } else {
      setShowWarningBanner(false);
    }
  }, [hasNotificationsEnabled, hasFilters, filtersLocallySet, preferencesLoaded, warningDismissed]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const handleFiltersUpdated = (hasFilters: boolean) => {
    setFiltersLocallySet(hasFilters);
  };

  const checkPreferences = async () => {
    try {
      const { data: prefs, error: prefsError } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prefsError && prefsError.code !== 'PGRST116') {
        console.error("Error fetching preferences:", prefsError);
        setPreferencesLoaded(true);
        return;
      }

      if (prefs) {
        // Check if notifications are enabled
        const notificationsEnabled = prefs.client_needs_enabled === true;

        // Check if any filters are set
        const hasPriceFilter = prefs.min_price != null || prefs.max_price != null;
        const hasPropertyTypes = prefs.property_types && Array.isArray(prefs.property_types) && prefs.property_types.length > 0;
        
        // Check geographic preferences (must complete before deciding hasAnyFilters)
        const { data: geoPrefs, error: geoError } = await supabase
          .from("agent_buyer_coverage_areas")
          .select("id")
          .eq("agent_id", user.id)
          .limit(1);

        if (geoError) {
          console.error("Error fetching geographic preferences:", geoError);
        }

        const hasGeographicFilter = !geoError && geoPrefs && geoPrefs.length > 0;
        const hasAnyFilters = hasPriceFilter || hasPropertyTypes || hasGeographicFilter;
        
        // Temporary logging for debugging
        console.log("ClientNeedsDashboard prefs:", {
          notificationsEnabled,
          hasPriceFilter,
          hasPropertyTypes,
          hasGeographicFilter,
          hasAnyFilters,
        });
        
        // Batch state updates to prevent race conditions
        setHasNotificationsEnabled(notificationsEnabled);
        setHasFilters(hasAnyFilters);
        setPreferencesLoaded(true);
      } else {
        // No preferences found
        setHasNotificationsEnabled(false);
        setHasFilters(false);
        setPreferencesLoaded(true);
      }
    } catch (error) {
      console.error("Error checking preferences:", error);
      setPreferencesLoaded(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8 pt-24 pb-16 max-w-6xl min-h-[600px]">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/agent-dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold mb-2">Connect . Communicate . Collaborate</h1>
              <p className="text-lg text-muted-foreground">Turning relationships into results</p>
            </div>
          </div>
          <p className="text-base text-muted-foreground max-w-3xl">
            Share your active client needs and receive targeted matches from other agents. Customize your alerts by market and property type for insider-level visibility.
          </p>
        </div>

        {/* Notification Preference Cards */}
        <section className="mb-8 min-h-[260px]">
          <NotificationPreferenceCards />
        </section>

        {/* Separator */}
        <Separator className="my-8" />

        {/* My Preferences Section */}
        <div className="mb-8" data-preferences-section>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Set My Preferences</h2>
            <p className="text-sm text-muted-foreground mt-1">(For receiving email notifications only)</p>
          </div>
          <div className="space-y-6">
            <PriceRangePreferences 
              agentId={user?.id || ""} 
              onFiltersUpdated={handleFiltersUpdated}
            />
            <PropertyTypePreferences 
              agentId={user?.id || ""} 
              onFiltersUpdated={handleFiltersUpdated}
            />
            <GeographicPreferencesManager 
              agentId={user?.id || ""} 
              onFiltersUpdated={handleFiltersUpdated}
            />
          </div>
        </div>

        {/* Notification Settings - Required (Final Step) */}
        <ClientNeedsNotificationSettings />

        {/* Warning Banner Region - reserve space to prevent layout shift */}
        <div className="mt-8 min-h-[120px]">
          {showWarningBanner && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-yellow-600 dark:text-yellow-400 text-2xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-1">
                    Important: You'll Receive All Notifications
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                    You have email notifications enabled but haven't set any filters (price range, property types, or locations). 
                    This means you will receive notifications for <strong>ALL</strong> client needs submitted by other agents. 
                    Consider setting some preferences above to filter the notifications you receive.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white dark:bg-gray-800"
                      onClick={() => {
                        document.querySelector('[data-preferences-section]')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Set Preferences
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white dark:bg-gray-800"
                      onClick={() => setShowWarningDialog(true)}
                    >
                      Review Options
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Warning Dialog - Must Set Preferences */}
        <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Set Your Notification Preferences</AlertDialogTitle>
              <AlertDialogDescription>
                In order to receive email notifications, you must select your preferences.
                Please set at least one filter: price range, property types, or geographic areas.
                Without filters, you'll receive notifications for ALL client needs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={async () => {
                const key = `clientNeedsWarningDismissed:${user.id}`;
                localStorage.setItem(key, "true");
                setWarningDismissed(true);
                setShowWarningBanner(false);
                setShowWarningDialog(false);
                setHasNotificationsEnabled(false);
                await supabase.from("notification_preferences")
                  .upsert({ user_id: user.id, client_needs_enabled: false }, { onConflict: 'user_id' });
              }}>
                Disable Notifications
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                const key = `clientNeedsWarningDismissed:${user.id}`;
                localStorage.setItem(key, "true");
                setWarningDismissed(true);
                setShowWarningBanner(false);
                setShowWarningDialog(false);
                document.querySelector('[data-preferences-section]')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Set Preferences Now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default ClientNeedsDashboard;
