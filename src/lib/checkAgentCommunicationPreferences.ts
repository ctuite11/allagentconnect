import { supabase } from "@/integrations/supabase/client";

/**
 * Whether the agent has saved at least one Communications Center targeting filter
 * (price range, property types, or geographic coverage) — same criteria as ClientNeedsDashboard.
 */
export async function checkAgentCommunicationPreferencesSet(userId: string): Promise<boolean> {
  const { data: prefs, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (prefsError && prefsError.code !== "PGRST116") {
    console.error("Error fetching communication preferences:", prefsError);
    return false;
  }

  if (!prefs) return false;

  const hasNoMin = (prefs as Record<string, unknown>).has_no_min ?? true;
  const hasNoMax = (prefs as Record<string, unknown>).has_no_max ?? true;
  const hasPriceFilter =
    !hasNoMin || !hasNoMax || prefs.min_price != null || prefs.max_price != null;
  const hasPropertyTypes =
    Array.isArray(prefs.property_types) && prefs.property_types.length > 0;

  const { data: geoPrefs, error: geoError } = await supabase
    .from("agent_buyer_coverage_areas")
    .select("id")
    .eq("agent_id", userId)
    .limit(1);

  if (geoError) {
    console.error("Error fetching geographic preferences:", geoError);
  }

  const hasGeographicFilter = !geoError && Boolean(geoPrefs?.length);
  return (hasPriceFilter && !(hasNoMin && hasNoMax)) || hasPropertyTypes || hasGeographicFilter;
}
