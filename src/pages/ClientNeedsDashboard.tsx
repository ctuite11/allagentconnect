import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2, Inbox, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationPreferenceCards } from "@/components/NotificationPreferenceCards";
import { ClientNeedsNotificationSettings } from "@/components/ClientNeedsNotificationSettings";
import GeographicPreferencesManager, { GeographicData } from "@/components/GeographicPreferencesManager";
import PriceRangePreferences, { PriceRangeData } from "@/components/PriceRangePreferences";
import PropertyTypePreferences from "@/components/PropertyTypePreferences";
import { toast } from "sonner";
import { aacStyles } from "@/ui/aacStyles";
import { Seo } from "@/components/Seo";
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

/** Comms Center — restored workflow from git 24b73b21 (full page; parent of 4e8293b6 was already the stub). */
const ClientNeedsDashboard = () => {
  const navigate = useNavigate();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [hasNotificationsEnabled, setHasNotificationsEnabled] = useState(false);
  const [hasFilters, setHasFilters] = useState(false);
  const [filtersLocallySet, setFiltersLocallySet] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const priceDataRef = useRef<PriceRangeData | null>(null);
  const geoDataRef = useRef<GeographicData | null>(null);
  const propertyTypesRef = useRef<string[] | null>(null);

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
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
    } finally {
      setSessionChecked(true);
    }
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
      if (priceDataRef.current) {
        const { error: priceError } = await supabase.from("notification_preferences").upsert(
          {
            user_id: user.id,
            min_price: priceDataRef.current.minPrice,
            max_price: priceDataRef.current.maxPrice,
            has_no_min: priceDataRef.current.hasNoMin,
            has_no_max: priceDataRef.current.hasNoMax,
          },
          {
            onConflict: "user_id",
          },
        );

        if (priceError) throw priceError;
      }

      if (propertyTypesRef.current) {
        const { error: propError } = await supabase.from("notification_preferences").upsert(
          {
            user_id: user.id,
            property_types: propertyTypesRef.current,
          },
          {
            onConflict: "user_id",
          },
        );

        if (propError) throw propError;
      }

      if (geoDataRef.current) {
        const { error: deleteError } = await supabase
          .from("agent_buyer_coverage_areas")
          .delete()
          .eq("agent_id", user.id)
          .eq("source", "notifications");

        if (deleteError) throw deleteError;

        if (geoDataRef.current.towns.length > 0) {
          const uniqueTowns = [...new Set(geoDataRef.current.towns)];
          const preferencesToInsert = uniqueTowns.map((town, index) => {
            const syntheticZip = String(index).padStart(5, "0");

            if (town.includes("-")) {
              const [city, neighborhood] = town.split("-");
              return {
                agent_id: user.id,
                state: geoDataRef.current!.state,
                county: geoDataRef.current!.county === "all" ? null : geoDataRef.current!.county,
                city,
                neighborhood,
                zip_code: syntheticZip,
                source: "notifications",
              };
            }
            return {
              agent_id: user.id,
              state: geoDataRef.current!.state,
              county: geoDataRef.current!.county === "all" ? null : geoDataRef.current!.county,
              city: town,
              neighborhood: null,
              zip_code: syntheticZip,
              source: "notifications",
            };
          });

          const { error: insertError } = await supabase.from("agent_buyer_coverage_areas").insert(preferencesToInsert);

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
    if (!user?.id) return;
    try {
      const { data: prefs, error: prefsError } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prefsError && prefsError.code !== "PGRST116") {
        console.error("Error fetching preferences:", prefsError);
        setPreferencesLoaded(true);
        return;
      }

      if (prefs) {
        const notificationsEnabled = prefs.client_needs_enabled === true;

        const hasNoMin = (prefs as Record<string, unknown>).has_no_min ?? true;
        const hasNoMax = (prefs as Record<string, unknown>).has_no_max ?? true;
        const hasPriceFilter =
          !hasNoMin || !hasNoMax || prefs.min_price != null || prefs.max_price != null;
        const hasPropertyTypes =
          prefs.property_types && Array.isArray(prefs.property_types) && prefs.property_types.length > 0;

        const { data: geoPrefs, error: geoError } = await supabase
          .from("agent_buyer_coverage_areas")
          .select("id")
          .eq("agent_id", user.id)
          .limit(1);

        if (geoError) {
          console.error("Error fetching geographic preferences:", geoError);
        }

        const hasGeographicFilter = !geoError && geoPrefs && geoPrefs.length > 0;
        const hasAnyFilters =
          (hasPriceFilter && !(hasNoMin && hasNoMax)) || hasPropertyTypes || hasGeographicFilter;

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
    <>
      <Seo
        title="Communications Center | All Agent Connect"
        description="Agent-to-agent channels, notification preferences, and email alert settings."
        canonical="https://allagentconnect.com/communications"
        noindex
      />
      {!sessionChecked ? (
        <div className="flex min-h-[50vh] w-full items-center justify-center bg-white" aria-busy="true">
          <Loader2 className="h-8 w-8 animate-spin text-[#0E56F5]" aria-hidden />
        </div>
      ) : !user ? (
        <div className="flex min-h-[40vh] w-full items-center justify-center bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-zinc-400" aria-hidden />
        </div>
      ) : (
      <div className="bg-white pt-6">
        <main className={`${aacStyles.pageContainer} pb-12`}>
          <PageHeader
            title="Communications Center"
            subtitle="Agent-to-agent collaboration and deal flow"
            className="mb-6"
            icon={<Inbox className="h-8 w-8 shrink-0 text-[#0E56F5]" aria-hidden />}
          />

          <section>
            <h2 className={aacStyles.sectionH2}>Channels</h2>
            <p className={aacStyles.sectionHelper}>Choose what you send and receive</p>
            <div className="mt-4">
              <NotificationPreferenceCards />
            </div>
          </section>

          <section data-preferences-section>
            <h2 className={aacStyles.sectionH2}>My Preferences</h2>
            <p className={aacStyles.sectionHelper}>
              Narrow which agent-network communications activity can trigger Comms Center email alerts.
            </p>

            <div className="space-y-3 mt-4">
              <PriceRangePreferences
                agentId={user?.id || ""}
                onFiltersUpdated={handleFiltersUpdated}
                onDataChange={handlePriceDataChange}
              />
              <PropertyTypePreferences
                agentId={user?.id || ""}
                onFiltersUpdated={handleFiltersUpdated}
                onDataChange={(data) => handlePropertyTypesChange(data.propertyTypes)}
              />
              <GeographicPreferencesManager
                agentId={user?.id || ""}
                onFiltersUpdated={handleFiltersUpdated}
                onDataChange={handleGeoDataChange}
              />
            </div>
          </section>

          <section>
            <h2 className={aacStyles.sectionH2}>Notification Settings</h2>
            <p className={aacStyles.sectionHelper}>Configure cadence for agent communication alerts from the network</p>
            <div className="mt-4">
              <ClientNeedsNotificationSettings />
            </div>
          </section>

          {showWarningBanner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 text-sm mb-1">
                    Important: Broad network communications alerts
                  </h3>
                  <p className="text-xs text-amber-800 mb-3">
                    You have Comms Center email alerts enabled but haven&apos;t set any filters below. That can mean alerts for{' '}
                    <strong>a wide range</strong> of agent-network communications activity.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="h-7 px-3 text-xs rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
                      onClick={() => {
                        document.querySelector("[data-preferences-section]")?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Set Preferences
                    </button>
                    <button
                      type="button"
                      className="h-7 px-3 text-xs rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
                      onClick={() => setShowWarningDialog(true)}
                    >
                      Review Options
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Set your communications preferences</AlertDialogTitle>
                <AlertDialogDescription>
                  To keep Comms Center email aligned with how you work, set at least one filter: price range, property types,
                  or geographic areas. Without filters, you may receive alerts for broad network communications activity.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={async () => {
                    if (!user?.id) return;
                    const key = `clientNeedsWarningDismissed:${user.id}`;
                    localStorage.setItem(key, "true");
                    setWarningDismissed(true);
                    setShowWarningBanner(false);
                    setShowWarningDialog(false);
                    setHasNotificationsEnabled(false);
                    await supabase
                      .from("notification_preferences")
                      .upsert({ user_id: user.id, client_needs_enabled: false }, { onConflict: "user_id" });
                  }}
                >
                  Turn off email alerts
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (!user?.id) return;
                    const key = `clientNeedsWarningDismissed:${user.id}`;
                    localStorage.setItem(key, "true");
                    setWarningDismissed(true);
                    setShowWarningBanner(false);
                    setShowWarningDialog(false);
                    document.querySelector("[data-preferences-section]")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Set Preferences Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>

        {hasUnsavedChanges && (
          <div className={aacStyles.stickyFooter}>
            <div className={`${aacStyles.stickyFooterInner} mx-auto max-w-7xl`}>
              <p className={aacStyles.unsavedText}>You have unsaved changes</p>
              <Button onClick={handleSavePreferences} disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Save Preferences"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
    </>
  );
};

export default ClientNeedsDashboard;
