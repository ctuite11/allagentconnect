import { supabase } from "@/integrations/supabase/client";

function hasSavedTargetingFilters(prefs: Record<string, unknown>): boolean {
  const hasNoMin = prefs.has_no_min ?? true;
  const hasNoMax = prefs.has_no_max ?? true;
  const hasPriceFilter =
    !hasNoMin || !hasNoMax || prefs.min_price != null || prefs.max_price != null;
  const hasPropertyTypes =
    Array.isArray(prefs.property_types) && prefs.property_types.length > 0;

  return (hasPriceFilter && !(hasNoMin && hasNoMax)) || hasPropertyTypes;
}

/**
 * Whether the agent has saved Communications Center targeting preferences.
 * Uses `agent_settings.preferences_set` when available, otherwise checks saved
 * notification filters (price, property types, notification-sourced coverage).
 */
export async function checkAgentCommunicationPreferencesSet(userId: string): Promise<boolean> {
  const { data: settings, error: settingsError } = await supabase
    .from("agent_settings")
    .select("preferences_set")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsError) {
    console.error("Error fetching agent settings:", settingsError);
  }

  if (settings?.preferences_set) return true;

  const { data: prefs, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (prefsError && prefsError.code !== "PGRST116") {
    console.error("Error fetching communication preferences:", prefsError);
    return false;
  }

  if (prefs && hasSavedTargetingFilters(prefs as Record<string, unknown>)) {
    return true;
  }

  const { data: geoPrefs, error: geoError } = await supabase
    .from("agent_buyer_coverage_areas")
    .select("id")
    .eq("agent_id", userId)
    .eq("source", "notifications")
    .limit(1);

  if (geoError) {
    console.error("Error fetching geographic preferences:", geoError);
    return false;
  }

  return Boolean(geoPrefs?.length);
}
