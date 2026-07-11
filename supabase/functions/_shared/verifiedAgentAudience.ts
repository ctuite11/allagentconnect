// Shared canonical eligibility helper for automatic agent notifications.
//
// Universal rule enforced by callers:
//   - Verified agent + eligible profile + preferences set   → send only when the domain match returns true.
//   - Verified agent + eligible profile + preferences unset → send unconditionally (fallback).
//   - Explicit category opt-out                             → never send (authoritative).
//   - Global unsubscribe / suppression                      → never send.
//   - Sender/owner of the content                           → never send.
//   - Duplicate for the same source event                   → never send.

export interface EligibleAgent {
  agent_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  preferences_set: boolean;
  /**
   * Value of `agent_settings.<domain-flag>` where applicable.
   * Callers pass the specific column name they care about. When null we treat
   * "no explicit setting" as opted-in.
   */
  category_opt_in: boolean | null;
}

export interface AudienceOptions {
  /**
   * Optional column name on `agent_settings` used to represent an explicit
   * per-category opt-out. When provided, the helper returns each agent's
   * value so the caller can honor it authoritatively.
   */
  optOutColumn?: string;
}

/**
 * Returns the canonical audience of verified, profile-eligible agents,
 * annotated with whether they have configured any preferences and their
 * explicit category opt-in state.
 *
 * "Preferences set" is TRUE when ANY of the following holds:
 *   - `agent_settings.preferences_set = true`
 *   - ≥ 1 row in `agent_buyer_coverage_areas`
 *   - ≥ 1 row in `agent_state_preferences`
 *   - ≥ 1 row in `agent_county_preferences`
 */
export async function getVerifiedAgentAudience(
  supabase: any,
  opts: AudienceOptions = {},
): Promise<EligibleAgent[]> {
  const optOutColumn = opts.optOutColumn;

  // Verified + agent role, with eligible profile (non-blank email).
  const settingsSelect = [
    "user_id",
    "preferences_set",
    optOutColumn ? optOutColumn : null,
  ]
    .filter(Boolean)
    .join(", ");

  const { data: settings, error: settingsErr } = await supabase
    .from("agent_settings")
    .select(settingsSelect)
    .eq("agent_status", "verified");
  if (settingsErr) throw settingsErr;
  if (!settings?.length) return [];

  const userIds = settings.map((r: any) => r.user_id);

  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "agent")
    .in("user_id", userIds);
  const agentRoleIds = new Set((roles || []).map((r: any) => r.user_id));

  const { data: profiles } = await supabase
    .from("agent_profiles")
    .select("id, email, first_name, last_name")
    .in("id", userIds);
  const profileMap = new Map<string, any>();
  for (const p of profiles || []) {
    if (p?.email && String(p.email).trim().length > 0) profileMap.set(p.id, p);
  }

  const eligibleIds = userIds.filter(
    (id: string) => agentRoleIds.has(id) && profileMap.has(id),
  );
  if (!eligibleIds.length) return [];

  // Preference-source signals
  const [cov, states, counties] = await Promise.all([
    supabase.from("agent_buyer_coverage_areas").select("agent_id").in("agent_id", eligibleIds),
    supabase.from("agent_state_preferences").select("agent_id").in("agent_id", eligibleIds),
    supabase.from("agent_county_preferences").select("agent_id").in("agent_id", eligibleIds),
  ]);

  const withPrefs = new Set<string>();
  for (const r of cov.data || []) withPrefs.add(r.agent_id);
  for (const r of states.data || []) withPrefs.add(r.agent_id);
  for (const r of counties.data || []) withPrefs.add(r.agent_id);

  // Suppression list (global unsubscribe by email)
  const emails = eligibleIds.map((id: string) => profileMap.get(id).email.toLowerCase());
  const { data: unsubs } = await supabase
    .from("email_unsubscribes")
    .select("email")
    .in("email", emails);
  const suppressed = new Set((unsubs || []).map((u: any) => String(u.email).toLowerCase()));

  const settingsById = new Map<string, any>(
    (settings || []).map((s: any) => [s.user_id, s]),
  );

  const out: EligibleAgent[] = [];
  for (const id of eligibleIds) {
    const profile = profileMap.get(id);
    const emailLc = String(profile.email).toLowerCase();
    if (suppressed.has(emailLc)) continue;

    const s = settingsById.get(id) || {};
    const preferencesSet = Boolean(s.preferences_set) || withPrefs.has(id);
    const categoryOptIn = optOutColumn
      ? (s[optOutColumn] === null || s[optOutColumn] === undefined ? null : Boolean(s[optOutColumn]))
      : null;

    out.push({
      agent_id: id,
      email: profile.email,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
      preferences_set: preferencesSet,
      category_opt_in: categoryOptIn,
    });
  }
  return out;
}

/**
 * Applies the universal fan-out rule to a pre-fetched audience.
 *
 * @param audience  From getVerifiedAgentAudience()
 * @param matches   Function returning true when this agent's preferences match
 *                  the event. Only consulted when the agent has preferences set.
 * @param senderId  Agent to exclude (owner/submitter of the event).
 * @param honorOptOut  If true, agents with `category_opt_in === false` are
 *                    dropped. Default true.
 */
export function classifyRecipients<T extends EligibleAgent>(
  audience: T[],
  matches: (agent: T) => boolean,
  senderId: string | null,
  honorOptOut = true,
): Array<T & { reason: "preferences_match" | "preferences_unset" }> {
  const out: Array<T & { reason: "preferences_match" | "preferences_unset" }> = [];
  for (const a of audience) {
    if (senderId && a.agent_id === senderId) continue;
    if (honorOptOut && a.category_opt_in === false) continue;
    if (a.preferences_set) {
      if (matches(a)) out.push({ ...a, reason: "preferences_match" });
    } else {
      out.push({ ...a, reason: "preferences_unset" });
    }
  }
  return out;
}