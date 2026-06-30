import { supabase } from "@/integrations/supabase/client";

/**
 * Ensure the four Communications Center channel toggles are ON for an agent
 * who has never explicitly configured preferences.
 *
 * Rules:
 *   - Never overwrite an agent whose `agent_settings.preferences_set = true`.
 *   - Never touch targeting filters (price, property type, geographic coverage).
 *   - Never flip `preferences_set` — that flag stays "explicit user choice".
 *   - Only flips channel booleans when the row is missing OR all four are false.
 */
export async function ensureDefaultCommsChannels(userId: string): Promise<void> {
  if (!userId) return;

  try {
    const { data: settings } = await supabase
      .from("agent_settings")
      .select("preferences_set")
      .eq("user_id", userId)
      .maybeSingle();

    if (settings?.preferences_set === true) return;

    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("buyer_need, sales_intel, renter_need, general_discussion")
      .eq("user_id", userId)
      .maybeSingle();

    const allOff =
      !prefs ||
      (
        prefs.buyer_need !== true &&
        prefs.sales_intel !== true &&
        prefs.renter_need !== true &&
        prefs.general_discussion !== true
      );

    if (!allOff) return;

    await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: userId,
          buyer_need: true,
          sales_intel: true,
          renter_need: true,
          general_discussion: true,
        },
        { onConflict: "user_id" },
      );
  } catch (err) {
    console.warn("[ensureDefaultCommsChannels] non-fatal:", err);
  }
}