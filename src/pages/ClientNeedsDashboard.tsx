import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2, AlertTriangle, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommsChannelHubCards } from "@/components/communication-center/CommsChannelHubCards";
import { ClientNeedsNotificationSettings } from "@/components/ClientNeedsNotificationSettings";
import GeographicPreferencesManager, { GeographicData } from "@/components/GeographicPreferencesManager";
import PriceRangePreferences, { PriceRangeData } from "@/components/PriceRangePreferences";
import PropertyTypePreferences from "@/components/PropertyTypePreferences";
import { toast } from "sonner";
import { hasNotificationTargetingConfigured } from "@/lib/checkAgentCommunicationPreferences";
import { COMMS_FILTERS_UI } from "@/lib/commsFiltersCopy";
import { Seo } from "@/components/Seo";
import { SendEmailDialog } from "@/components/communication-center/SendEmailDialog";
import { isBuyerNeedComposeRequested, BUYER_NEED_COMPOSE_ROUTE } from "@/lib/buyerNeedCompose";
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

/** localStorage key — per-user dismissal of the email alert coverage notice. */
const emailAlertNoticeDismissedKey = (userId: string) =>
  `commsCenterEmailAlertNoticeDismissed:${userId}`;

/** Communications Center — notification channels, filters, and email cadence (agent). */
const ClientNeedsDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [hasNotificationsEnabled, setHasNotificationsEnabled] = useState(false);
  const [hasFilters, setHasFilters] = useState(false);
  const [filtersLocallySet, setFiltersLocallySet] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [emailAlertNoticeDismissed, setEmailAlertNoticeDismissed] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [channelPreferencesVersion, setChannelPreferencesVersion] = useState(0);
  const [muteAllState, setMuteAllState] = useState<{ anyEnabled: boolean; muteAll: () => void } | null>(null);
  // Canonical Buyer Need compose flow. `/submit-client-need` and every
  // homepage CTA redirect here with ?compose=buyer-need.
  const [composeOpen, setComposeOpen] = useState(false);
  // Opt-in policy (Aug 2026): channels are OFF until the agent turns one on.
  // The old default-on notice/overlay is retired.

  const priceDataRef = useRef<PriceRangeData | null>(null);
  const geoDataRef = useRef<GeographicData | null>(null);
  const propertyTypesRef = useRef<string[] | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const state = location.state as { scrollToPreferences?: boolean } | null;
    const params = new URLSearchParams(location.search);
    const sectionFilters = params.get("section") === "filters";
    if (!state?.scrollToPreferences && !sectionFilters) return;

    requestAnimationFrame(() => {
      document.querySelector("[data-preferences-section]")?.scrollIntoView({ behavior: "smooth" });
    });
    if (state?.scrollToPreferences) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (isBuyerNeedComposeRequested(location.search)) setComposeOpen(true);
  }, [location.search]);

  useEffect(() => {
    if (user?.id) {
      checkPreferences();
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    const dismissed = localStorage.getItem(emailAlertNoticeDismissedKey(user.id)) === "true";
    setEmailAlertNoticeDismissed(dismissed);
  }, [user?.id]);

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

  const dismissEmailAlertNotice = () => {
    if (!user?.id) return;
    localStorage.setItem(emailAlertNoticeDismissedKey(user.id), "true");
    setEmailAlertNoticeDismissed(true);
  };


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

      toast.success(COMMS_FILTERS_UI.savedToast);
      setHasUnsavedChanges(false);
      if (await hasNotificationTargetingConfigured(user.id)) {
        await supabase.from("agent_settings").update({ preferences_set: true }).eq("user_id", user.id);
      }
      await checkPreferences();
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error(COMMS_FILTERS_UI.saveFailedToast);
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
          .eq("source", "notifications")
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
        description={COMMS_FILTERS_UI.seoDescription}
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

          <section id="comms-channels" className="space-y-4 scroll-mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">Channels</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Your hub for buyer demand, rentals, market intel, and network conversation.
                </p>
              </div>
              {muteAllState?.anyEnabled && (
                <button
                  type="button"
                  onClick={muteAllState.muteAll}
                  className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
                >
                  Mute all
                </button>
              )}
            </div>
            <CommsChannelHubCards
              onPreferencesChange={() => setChannelPreferencesVersion((v) => v + 1)}
              onMuteAllStateChange={setMuteAllState}
            />
          </section>

          <div className="space-y-5">
            {!emailAlertNoticeDismissed && (
              <div className="relative rounded-xl border border-emerald-300 bg-emerald-100/70 px-4 py-3">
                <button
                  type="button"
                  onClick={dismissEmailAlertNotice}
                  aria-label="Dismiss notice"
                  className="absolute right-3 top-3 rounded-md p-1 text-emerald-700/60 transition-colors hover:bg-emerald-200/80 hover:text-emerald-800"
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
                <div className="flex gap-3 pr-6">
                  <SlidersHorizontal
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div>
                    <h3 className="text-base font-bold tracking-tight text-emerald-700">Set your email filters</h3>
                    <p className="mt-1 text-sm leading-snug text-neutral-700">
                      Choose your areas, price ranges, and property types to eliminate unwanted emails and only receive
                      the opportunities that matter to you.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <section data-preferences-section className="space-y-2.5">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Your email filters</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                Set your coverage area to limit unwanted email alerts.
              </p>
            </div>

            <div className="space-y-2.5">
              <GeographicPreferencesManager
                agentId={user?.id || ""}
                onFiltersUpdated={handleFiltersUpdated}
                onDataChange={handleGeoDataChange}
              />
              <PropertyTypePreferences
                agentId={user?.id || ""}
                onFiltersUpdated={handleFiltersUpdated}
                onDataChange={(data) => handlePropertyTypesChange(data.propertyTypes)}
              />
              <PriceRangePreferences
                agentId={user?.id || ""}
                onFiltersUpdated={handleFiltersUpdated}
                onDataChange={handlePriceDataChange}
              />
            </div>
          </section>
          </div>

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
                      {COMMS_FILTERS_UI.setFilters}
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
                <AlertDialogTitle>{COMMS_FILTERS_UI.dialogTitle}</AlertDialogTitle>
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
                  {COMMS_FILTERS_UI.setFiltersNow}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>

        {hasUnsavedChanges && (
          <div className="sticky bottom-0 z-40 border-t border-neutral-200 bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-end px-6 py-4">
              <Button type="button" onClick={handleSavePreferences} disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Saving...
                  </span>
                ) : (
                  COMMS_FILTERS_UI.saveFilters
                )}
              </Button>
            </div>
          </div>
        )}

        <SendEmailDialog
          open={composeOpen}
          onOpenChange={(next) => {
            setComposeOpen(next);
            if (!next && isBuyerNeedComposeRequested(location.search)) {
              navigate("/communications", { replace: true });
            }
          }}
        />
      </div>
    </>
  );
};

export default ClientNeedsDashboard;
