// Shared canonical eligibility helper for automatic agent notifications.
//
// Universal rule enforced by callers via partitionAudience:
//   Base eligibility = activated + verified + user_roles.role='agent'
//     - Activated  : agent_settings.account_activated_at IS NOT NULL
//     - Verified   : agent_settings.agent_status = 'verified'
//   Real content bucket (per-event):
//     - profile_complete && has_email && (preferences_set ? matches : true)
//     - Excludes senderId, explicit category opt-out, globally suppressed email
//   Reminder bucket (account/service reminder — "You're Missing Opportunities"):
//     - !profile_complete && has_email
//     - Excludes senderId, globally suppressed email
//     - Ignores category opt-outs (account/service, not marketing)
//   Never eligible: not activated, not verified, no email, globally suppressed.

export interface EligibleAgent {
  agent_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  preferences_set: boolean;
  profile_complete: boolean;
  has_email: boolean;
}

function isNonEmpty(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
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
): Promise<EligibleAgent[]> {
  // 1) Activated + verified agents (canonical activation source used by Admin Approvals).
  const { data: settings, error: settingsErr } = await supabase
    .from("agent_settings")
    .select("user_id, preferences_set, account_activated_at")
    .eq("agent_status", "verified")
    .not("account_activated_at", "is", null);
  if (settingsErr) throw settingsErr;
  if (!settings?.length) return [];

  const userIds = settings.map((r: any) => r.user_id);

  // 2) Must also have the agent role.
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "agent")
    .in("user_id", userIds);
  const agentRoleIds = new Set((roles || []).map((r: any) => r.user_id));

  const eligibleIds = userIds.filter((id: string) => agentRoleIds.has(id));
  if (!eligibleIds.length) return [];

  // 3) Profile fields needed to evaluate completeness + delivery.
  const { data: profiles } = await supabase
    .from("agent_profiles")
    .select("id, email, first_name, last_name, headshot_url, company")
    .in("id", eligibleIds);
  const profileMap = new Map<string, any>();
  for (const p of profiles || []) profileMap.set(p.id, p);

  // 4) Preference-source signals.
  const [cov, states, counties] = await Promise.all([
    supabase.from("agent_buyer_coverage_areas").select("agent_id").in("agent_id", eligibleIds),
    supabase.from("agent_state_preferences").select("agent_id").in("agent_id", eligibleIds),
    supabase.from("agent_county_preferences").select("agent_id").in("agent_id", eligibleIds),
  ]);

  const withPrefs = new Set<string>();
  for (const r of cov.data || []) withPrefs.add(r.agent_id);
  for (const r of states.data || []) withPrefs.add(r.agent_id);
  for (const r of counties.data || []) withPrefs.add(r.agent_id);

  // 5) Global suppression list (unsubscribe by email).
  const emailsForSuppression = eligibleIds
    .map((id: string) => profileMap.get(id)?.email)
    .filter((e: any) => isNonEmpty(e))
    .map((e: string) => e.toLowerCase());
  const { data: unsubs } = await supabase
    .from("email_unsubscribes")
    .select("email")
    .in("email", emailsForSuppression);
  const suppressed = new Set((unsubs || []).map((u: any) => String(u.email).toLowerCase()));

  const settingsById = new Map<string, any>(
    (settings || []).map((s: any) => [s.user_id, s]),
  );

  const out: EligibleAgent[] = [];
  for (const id of eligibleIds) {
    const profile = profileMap.get(id) || {};
    const emailRaw = typeof profile.email === "string" ? profile.email : "";
    const emailTrim = emailRaw.trim();
    const emailLc = emailTrim.toLowerCase();

    // Suppression is absolute — drop before either bucket.
    if (emailLc && suppressed.has(emailLc)) continue;

    const has_email = isNonEmpty(emailTrim);
    const profile_complete =
      isNonEmpty(profile.first_name) &&
      isNonEmpty(profile.last_name) &&
      isNonEmpty(profile.headshot_url) &&
      isNonEmpty(profile.company) &&
      has_email;

    const s = settingsById.get(id) || {};
    const preferences_set = Boolean(s.preferences_set) || withPrefs.has(id);

    out.push({
      agent_id: id,
      email: emailTrim,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
      preferences_set,
      profile_complete,
      has_email,
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
  optedOut?: Set<string>,
): Array<T & { reason: "preferences_match" | "preferences_unset" }> {
  const out: Array<T & { reason: "preferences_match" | "preferences_unset" }> = [];
  for (const a of audience) {
    if (senderId && a.agent_id === senderId) continue;
    if (optedOut && optedOut.has(a.agent_id)) continue;
    // Legacy callers: only consider profile-complete + has-email agents.
    if (!a.profile_complete || !a.has_email) continue;
    if (a.preferences_set) {
      if (matches(a)) out.push({ ...a, reason: "preferences_match" });
    } else {
      out.push({ ...a, reason: "preferences_unset" });
    }
  }
  return out;
}

export type PartitionReason = "preferences_match" | "preferences_unset";

export interface PartitionedRecipient<T extends EligibleAgent> {
  agent: T;
  reason: PartitionReason;
}

export interface AudiencePartition<T extends EligibleAgent> {
  real: Array<T & { reason: PartitionReason }>;
  reminder: T[];
  counts: {
    audience_total: number;
    profile_complete: number;
    profile_incomplete: number;
    no_email: number;
    self_excluded: number;
    category_opted_out: number;
    preferences_matched: number;
    preferences_unset_fallback: number;
    non_matching: number;
  };
}

/**
 * Splits a canonical audience into the real-content bucket and the
 * missing-opportunities reminder bucket.
 *
 * Real bucket: profile_complete + has_email + (preferences_set ? matches : true),
 *              excluding senderId and category opt-outs.
 * Reminder bucket: !profile_complete + has_email, excluding senderId.
 *                  Category opt-outs do NOT suppress the reminder.
 * No-email agents are excluded from both buckets and counted separately.
 */
export function partitionAudience<T extends EligibleAgent>(
  audience: T[],
  matches: (agent: T) => boolean,
  senderId: string | null,
  optedOut?: Set<string>,
): AudiencePartition<T> {
  const real: Array<T & { reason: PartitionReason }> = [];
  const reminder: T[] = [];

  let profile_complete = 0;
  let profile_incomplete = 0;
  let no_email = 0;
  let self_excluded = 0;
  let category_opted_out = 0;
  let preferences_matched = 0;
  let preferences_unset_fallback = 0;
  let non_matching = 0;

  for (const a of audience) {
    if (senderId && a.agent_id === senderId) {
      self_excluded++;
      continue;
    }
    if (!a.has_email) {
      no_email++;
      continue;
    }
    if (a.profile_complete) {
      profile_complete++;
      if (optedOut && optedOut.has(a.agent_id)) {
        category_opted_out++;
        continue;
      }
      if (a.preferences_set) {
        if (matches(a)) {
          real.push({ ...a, reason: "preferences_match" });
          preferences_matched++;
        } else {
          non_matching++;
        }
      } else {
        real.push({ ...a, reason: "preferences_unset" });
        preferences_unset_fallback++;
      }
    } else {
      profile_incomplete++;
      reminder.push(a);
    }
  }

  return {
    real,
    reminder,
    counts: {
      audience_total: audience.length,
      profile_complete,
      profile_incomplete,
      no_email,
      self_excluded,
      category_opted_out,
      preferences_matched,
      preferences_unset_fallback,
      non_matching,
    },
  };
}