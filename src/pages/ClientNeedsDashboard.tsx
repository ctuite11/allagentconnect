import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationPreferenceCards } from "@/components/NotificationPreferenceCards";
import { ClientNeedsNotificationSettings } from "@/components/ClientNeedsNotificationSettings";
import GeographicPreferencesManager, { GeographicData } from "@/components/GeographicPreferencesManager";
import PriceRangePreferences, { PriceRangeData } from "@/components/PriceRangePreferences";
import PropertyTypePreferences from "@/components/PropertyTypePreferences";
import { toast } from "sonner";
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

/** Communications Center — notification channels, filters, and email cadence (agent). */
const ClientNeedsDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
      <div className="bg-white" data-aac-page="communications-center">
        <main className="mx-auto max-w-7xl space-y-5 px-6 pb-8 pt-4">
          <PageHeader
            title="Communications Center"
            subtitle="Agent-to-agent collaboration and deal flow"
            titleClassName="text-neutral-900"
            subtitleClassName="text-neutral-500"
            className="mb-0"
          />

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900">Channels</h2>
            <p className="text-sm text-neutral-500">Choose what you send and receive</p>
            <NotificationPreferenceCards />
          </section>

          <section data-preferences-section className="space-y-2.5">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Email alert settings</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                Set your coverage area to limit unwanted email alerts.
              </p>
            </div>

            <div className="space-y-2.5">
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

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900">Notification Settings</h2>
            <p className="text-sm text-neutral-500">
              Configure cadence for agent communication alerts from the network
            </p>
            <ClientNeedsNotificationSettings />
          </section>

          {showWarningBanner && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 text-sm font-semibold text-amber-900">
                    Important: Broad network communications alerts
                  </h3>
                  <p className="mb-3 text-xs text-amber-800">
                    You have Comms Center email alerts enabled but haven&apos;t set any filters below. That can mean
                    alerts for <strong>a wide range</strong> of agent-network communications activity.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="h-7 rounded-md border border-amber-300 bg-white px-3 text-xs text-amber-900 hover:bg-amber-50"
                      onClick={() => {
                        document.querySelector("[data-preferences-section]")?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Set Preferences
                    </button>
                    <button
                      type="button"
                      className="h-7 rounded-md border border-amber-300 bg-white px-3 text-xs text-amber-900 hover:bg-amber-50"
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
                  To keep Comms Center email aligned with how you work, set at least one filter: price range, property
                  types, or geographic areas. Without filters, you may receive alerts for broad network communications
                  activity.
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
          <div className="sticky bottom-0 z-40 border-t border-neutral-200 bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <p className="text-sm text-neutral-500">You have unsaved changes</p>
              <Button type="button" onClick={handleSavePreferences} disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
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
    </>
  );
};

export default ClientNeedsDashboard;
