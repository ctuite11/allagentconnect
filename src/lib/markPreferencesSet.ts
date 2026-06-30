import { supabase } from "@/integrations/supabase/client";

/**
 * Marks an agent's preferences as explicitly configured.
 *
 * Call after any manual edit to notification channels or buyer coverage so
 * the default-on auto-enable logic stops applying and the
 * "defaults are on" inline notice goes away.
 */
export async function markPreferencesSet(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await supabase
      .from("agent_settings")
      .update({ preferences_set: true })
      .eq("user_id", userId);
  } catch (err) {
    console.warn("[markPreferencesSet] non-fatal:", err);
  }
}