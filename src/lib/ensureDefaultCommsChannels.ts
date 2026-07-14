import { supabase } from "@/integrations/supabase/client";

/**
 * Ensure the four Communications Center channel toggles are ON for an agent
 * who has never explicitly configured preferences.
 *
 * NOTE (2026-07): The DB defaults for these four columns were flipped to
 * `true` and all existing rows were backfilled to `true`. This helper is now
 * largely redundant — a fresh notification_preferences insert will already
 * yield all-ON. It remains here as a defensive safety net for the
 * AgentAccountSetup flow so any pre-existing all-false row from before the
 * backfill is still corrected on first login.
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

    await ensureDefaultBuyerCoverage(userId);
  } catch (err) {
    console.warn("[ensureDefaultCommsChannels] non-fatal:", err);
  }
}

/**
 * Ensures the agent has at least one buyer-coverage row so Buyer Need
 * broadcasts (which filter by `agent_buyer_coverage_areas.state`) can reach
 * them. Resolves a sensible default state from the agent's profile/license/
 * early-access record, falling back to "MA" (the network's primary market).
 *
 * - Never overwrites or touches existing coverage rows.
 * - Uses source='default' + zip_code='00000' as a sentinel so a real coverage
 *   entry the agent later adds in the UI won't conflict on the unique key
 *   (agent_id, zip_code, source).
 * - Never flips `preferences_set` — explicit user choice remains the only
 *   path to that flag.
 */
async function ensureDefaultBuyerCoverage(userId: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("agent_buyer_coverage_areas")
      .select("id")
      .eq("agent_id", userId)
      .limit(1);

    if (existing && existing.length > 0) return;

    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabase
        .from("agent_profiles")
        .select("email, office_state")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("agent_settings")
        .select("license_state")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    let earlyAccessState: string | null = null;
    if (profile?.email) {
      const { data: ea } = await supabase
        .from("agent_early_access")
        .select("state")
        .eq("email", profile.email)
        .maybeSingle();
      earlyAccessState = ea?.state ?? null;
    }

    const resolvedState =
      (earlyAccessState && earlyAccessState.trim()) ||
      (settings?.license_state && settings.license_state.trim()) ||
      (profile?.office_state && profile.office_state.trim()) ||
      "MA";

    await supabase
      .from("agent_buyer_coverage_areas")
      .upsert(
        {
          agent_id: userId,
          state: resolvedState,
          zip_code: "00000",
          source: "default",
        },
        { onConflict: "agent_id,zip_code,source" },
      );
  } catch (err) {
    console.warn("[ensureDefaultBuyerCoverage] non-fatal:", err);
  }
}