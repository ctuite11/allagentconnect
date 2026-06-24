import { supabase } from "@/integrations/supabase/client";

async function hasNotificationSourcedCoverage(userId: string): Promise<boolean> {
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

function hasExplicitPriceOrTypeTargeting(prefs: Record<string, unknown>): boolean {
  const hasPropertyTypes =
    Array.isArray(prefs.property_types) && prefs.property_types.length > 0;
  if (hasPropertyTypes) return true;

  const min = prefs.min_price;
  const max = prefs.max_price;
  if (min != null || max != null) return true;

  const hasNoMin = prefs.has_no_min === true;
  const hasNoMax = prefs.has_no_max === true;
  // Deliberate price-range choice — not the DB default `false` / `false` with null prices.
  return hasNoMin || hasNoMax;
}

/** Saved Comms Center targeting filters (ignores `preferences_set`). */
export async function hasNotificationTargetingConfigured(userId: string): Promise<boolean> {
  const { data: prefs, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("min_price, max_price, has_no_min, has_no_max, property_types")
    .eq("user_id", userId)
    .maybeSingle();

  if (prefsError && prefsError.code !== "PGRST116") {
    console.error("Error fetching communication preferences:", prefsError);
    return false;
  }

  if (prefs && hasExplicitPriceOrTypeTargeting(prefs as Record<string, unknown>)) {
    return true;
  }

  return hasNotificationSourcedCoverage(userId);
}

/**
 * Whether the agent completed Communications Center targeting setup.
 * Requires `agent_settings.preferences_set` plus saved notification targeting.
 */
export async function checkAgentCommunicationPreferencesSet(userId: string): Promise<boolean> {
  const { data: settings, error: settingsError } = await supabase
    .from("agent_settings")
    .select("preferences_set")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsError) {
    console.error("Error fetching agent settings:", settingsError);
    return false;
  }

  if (settings?.preferences_set !== true) {
    return false;
  }

  return hasNotificationTargetingConfigured(userId);
}
