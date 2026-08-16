import { supabase } from "@/integrations/supabase/client";
import { getRouteForRole, type ResolvedRoleResult } from "@/lib/resolveUserRole";

/** Query flag so the Comms page can show the one-time welcome banner. */
export const COMMS_ONBOARDING_QUERY = "comms_onboarding";

/** Destination used only after successfully marking `comms_onboarding_seen_at`. */
export const COMMS_ONBOARDING_PATH = `/communications?${COMMS_ONBOARDING_QUERY}=1`;

export function isEligibleForCommsOnboardingRedirect(settings: {
  preferences_set?: boolean | null;
  comms_onboarding_seen_at?: string | null;
}): boolean {
  if (settings.preferences_set === true) return false;
  if (settings.comms_onboarding_seen_at != null) return false;
  return true;
}

/**
 * Post-auth home resolution with a one-time Communications Center redirect.
 *
 * - Valid `returnTo` always wins.
 * - Eligible verified agents: mark `comms_onboarding_seen_at` first, then
 *   return the Comms onboarding path only if that write succeeds.
 * - Never repeats after `comms_onboarding_seen_at` is set.
 */
export async function resolvePostAuthHomeRoute(options: {
  userId: string;
  resolved: ResolvedRoleResult;
  returnTo: string | null;
}): Promise<string> {
  const { userId, resolved, returnTo } = options;

  if (returnTo) return returnTo;

  const defaultHome = getRouteForRole(resolved);

  const isVerifiedAgentHome =
    resolved.role === "agent" &&
    (resolved.is_verified_agent === true || resolved.can_access_success_hub === true) &&
    defaultHome === "/agent-dashboard";

  if (!isVerifiedAgentHome) return defaultHome;

  const { data: settings, error: readError } = await supabase
    .from("agent_settings")
    .select("preferences_set, comms_onboarding_seen_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    console.warn("[commsOnboarding] settings read failed:", readError.message);
    return defaultHome;
  }

  // No agent_settings row → cannot persist seen_at; keep normal home.
  if (!settings) return defaultHome;

  if (!isEligibleForCommsOnboardingRedirect(settings)) {
    return defaultHome;
  }

  const seenAt = new Date().toISOString();
  const { data: marked, error: writeError } = await supabase
    .from("agent_settings")
    .update({ comms_onboarding_seen_at: seenAt })
    .eq("user_id", userId)
    .is("comms_onboarding_seen_at", null)
    .select("user_id")
    .maybeSingle();

  if (writeError || !marked) {
    console.warn(
      "[commsOnboarding] mark seen failed or already marked:",
      writeError?.message ?? "no row updated",
    );
    return defaultHome;
  }

  return COMMS_ONBOARDING_PATH;
}
