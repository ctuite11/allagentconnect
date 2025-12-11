import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Loader2, ArrowLeft, Bell, DollarSign, Home, MapPin, Settings, Megaphone, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationPreferenceCards } from "@/components/NotificationPreferenceCards";
import { ClientNeedsNotificationSettings } from "@/components/ClientNeedsNotificationSettings";
import GeographicPreferencesManager, { GeographicData } from "@/components/GeographicPreferencesManager";
import PriceRangePreferences, { PriceRangeData } from "@/components/PriceRangePreferences";
import PropertyTypePreferences from "@/components/PropertyTypePreferences";
import { Pill } from "@/components/ui/pill";
import { toast } from "sonner";
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

interface PreferenceSummary {
  receivingCount: number;
  sendingCount: number;
  propertyTypesCount: number;
  notificationSchedule: string;
  priceRange: string;
  geoCount: number;
}

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Store pending changes from child components
  const priceDataRef = useRef<PriceRangeData | null>(null);
  const geoDataRef = useRef<GeographicData | null>(null);
  const propertyTypesRef = useRef<string[] | null>(null);
  
  const [summary, setSummary] = useState<PreferenceSummary>({
    receivingCount: 0,
    sendingCount: 0,
    propertyTypesCount: 0,
    notificationSchedule: "Immediate",
    priceRange: "All",
    geoCount: 0,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user?.id) {
      checkPreferences();
    }
  }, [user]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    if (warningDismissed) return;

    if (!hasNotificationsEnabled) {
      setShowWarningBanner(false);
      return;
    }

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
    setHasUnsavedChanges(true);
  };

  const handlePriceDataChange = (data: PriceRangeData) => {
    priceDataRef.current = data;
    setHasUnsavedChanges(true);
  };

  const handleGeoDataChange = (data: GeographicData) => {
    geoDataRef.current = data;
    setHasUnsavedChanges(true);
  };

  const handlePropertyTypesChange = (types: string[]) => {
    propertyTypesRef.current = types;
    setHasUnsavedChanges(true);
  };

  const handleSavePreferences = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      // Save price preferences with explicit boolean columns
      if (priceDataRef.current) {
        const { error: priceError } = await supabase
          .from("notification_preferences")
          .upsert({
            user_id: user.id,
            min_price: priceDataRef.current.minPrice,
            max_price: priceDataRef.current.maxPrice,
            has_no_min: priceDataRef.current.hasNoMin,
            has_no_max: priceDataRef.current.hasNoMax,
          }, {
            onConflict: 'user_id'
          });
        
        if (priceError) throw priceError;
      }

      // Save property types
      if (propertyTypesRef.current) {
        const { error: propError } = await supabase
          .from("notification_preferences")
          .upsert({
            user_id: user.id,
            property_types: propertyTypesRef.current,
          }, {
            onConflict: 'user_id'
          });
        
        if (propError) throw propError;
      }

      // Save geographic preferences
      if (geoDataRef.current) {
        // First delete existing
        const { error: deleteError } = await supabase
          .from("agent_buyer_coverage_areas")
          .delete()
          .eq("agent_id", user.id)
          .eq("source", "notifications");

        if (deleteError) throw deleteError;

        // Insert new ones if any selected
        if (geoDataRef.current.towns.length > 0) {
          const uniqueTowns = [...new Set(geoDataRef.current.towns)];
          const preferencesToInsert = uniqueTowns.map((town, index) => {
            const syntheticZip = String(index).padStart(5, "0");
            
            if (town.includes('-')) {
              const [city, neighborhood] = town.split('-');
              return {
                agent_id: user.id,
                state: geoDataRef.current!.state,
                county: geoDataRef.current!.county === "all" ? null : geoDataRef.current!.county,
                city,
                neighborhood,
                zip_code: syntheticZip,
                source: "notifications",
              };
            } else {
              return {
                agent_id: user.id,
                state: geoDataRef.current!.state,
                county: geoDataRef.current!.county === "all" ? null : geoDataRef.current!.county,
                city: town,
                neighborhood: null,
                zip_code: syntheticZip,
                source: "notifications",
              };
            }
          });

          const { error: insertError } = await supabase
            .from("agent_buyer_coverage_areas")
            .insert(preferencesToInsert);

          if (insertError) throw insertError;
        }
      }

      toast.success("Preferences saved successfully");
      setHasUnsavedChanges(false);
      await checkPreferences();
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
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
        const notificationsEnabled = prefs.client_needs_enabled === true;
        
        // Use explicit boolean columns for price filter check
        const hasNoMin = (prefs as any).has_no_min ?? true;
        const hasNoMax = (prefs as any).has_no_max ?? true;
        const hasPriceFilter = !hasNoMin || !hasNoMax || prefs.min_price != null || prefs.max_price != null;
        const hasPropertyTypes = prefs.property_types && Array.isArray(prefs.property_types) && prefs.property_types.length > 0;
        
        const { data: geoPrefs, error: geoError } = await supabase
          .from("agent_buyer_coverage_areas")
          .select("id")
          .eq("agent_id", user.id)
          .limit(1);

        if (geoError) {
          console.error("Error fetching geographic preferences:", geoError);
        }

        const hasGeographicFilter = !geoError && geoPrefs && geoPrefs.length > 0;
        const hasAnyFilters = (hasPriceFilter && !(hasNoMin && hasNoMax)) || hasPropertyTypes || hasGeographicFilter;

        let receivingCount = 0;
        if (prefs.buyer_need) receivingCount++;
        if (prefs.sales_intel) receivingCount++;
        if (prefs.renter_need) receivingCount++;
        if (prefs.general_discussion) receivingCount++;

        let priceRange = "All";
        if (!hasNoMin && !hasNoMax && prefs.min_price && prefs.max_price) {
          priceRange = `$${prefs.min_price.toLocaleString()} - $${prefs.max_price.toLocaleString()}`;
        } else if (!hasNoMin && prefs.min_price) {
          priceRange = `$${prefs.min_price.toLocaleString()}+`;
        } else if (!hasNoMax && prefs.max_price) {
          priceRange = `Up to $${prefs.max_price.toLocaleString()}`;
        }

        const { count: geoCount } = await supabase
          .from("agent_buyer_coverage_areas")
          .select("*", { count: "exact", head: true })
          .eq("agent_id", user.id);

        const scheduleMap: Record<string, string> = {
          immediate: "Immediate",
          daily: "Daily",
          weekly: "Weekly"
        };

        setSummary({
          receivingCount,
          sendingCount: 0,
          propertyTypesCount: hasPropertyTypes ? (prefs.property_types as string[]).length : 0,
          notificationSchedule: scheduleMap[prefs.client_needs_schedule || "immediate"] || "Immediate",
          priceRange,
          geoCount: geoCount || 0,
        });
        
        setHasNotificationsEnabled(notificationsEnabled);
        setHasFilters(hasAnyFilters);
        setPreferencesLoaded(true);
      } else {
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
      <main className="container mx-auto px-4 py-8 pt-24 pb-24 max-w-5xl min-h-[600px]">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/agent-dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold font-display">Communications Center</h1>
                <p className="text-muted-foreground">Connect · Communicate · Collaborate</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl ml-16">
            Share your active client needs and receive targeted matches from other agents. Customize your alerts by market and property type.
          </p>
        </div>


        {/* Topics / Channels Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold font-display">Topics / Channels</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Select topics to send or receive notifications</p>
          <NotificationPreferenceCards />
        </section>

        <Separator className="my-8" />

        {/* My Preferences Section */}
        <section className="mb-8" data-preferences-section>
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold font-display">My Preferences</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">(For receiving email notifications only)</p>
          
          <div className="space-y-4">
            <PriceRangePreferences 
              agentId={user?.id || ""} 
              onFiltersUpdated={handleFiltersUpdated}
              onDataChange={handlePriceDataChange}
            />
            <PropertyTypePreferences 
              agentId={user?.id || ""} 
              onFiltersUpdated={handleFiltersUpdated}
            />
            <GeographicPreferencesManager 
              agentId={user?.id || ""} 
              onFiltersUpdated={handleFiltersUpdated}
              onDataChange={handleGeoDataChange}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Notification Settings Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold font-display">Notification Settings</h2>
          </div>
          <ClientNeedsNotificationSettings />
        </section>

        {/* Warning Banner */}
        {showWarningBanner && (
          <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="text-yellow-600 dark:text-yellow-400 text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-1">
                  Important: You'll Receive All Notifications
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                  You have email notifications enabled but haven't set any filters. 
                  This means you will receive notifications for <strong>ALL</strong> client needs. 
                  Consider setting some preferences above to filter notifications.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-background"
                    onClick={() => {
                      document.querySelector('[data-preferences-section]')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Set Preferences
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-background"
                    onClick={() => setShowWarningDialog(true)}
                  >
                    Review Options
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning Dialog */}
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

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg z-50">
        <div className="container mx-auto px-4 py-4 max-w-5xl flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {hasUnsavedChanges ? "You have unsaved changes" : ""}
          </p>
          <Button 
            onClick={handleSavePreferences}
            disabled={saving}
            className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-semibold px-6"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClientNeedsDashboard;
