// Shared canonical eligibility helper for automatic agent notifications.
//
// Universal rule enforced by callers via partitionAudience:
//   Base eligibility = Agent Network directory visibility + user_roles.role='agent'
//     - Verified            : agent_settings.agent_status = 'verified'
//     - Not hidden          : agent_settings.hide_from_directory = false
//     - Directory profile   : first_name, last_name, headshot_url all non-empty
//       (identical to /our-agents and /our-members visibility rule)
//   Note: account_activated_at is intentionally NOT part of eligibility —
//   directory-visible agents are eligible even if that column is null.
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
  const { audience } = await getVerifiedAgentAudienceWithStats(supabase);
  return audience;
}

export interface AudienceWithStats {
  audience: EligibleAgent[];
  globally_suppressed: number;
}

/**
 * Same canonical audience as {@link getVerifiedAgentAudience}, but also
 * returns pre-partition counts (globally_suppressed) so callers can surface
 * them in dry-run / debug output.
 */
export async function getVerifiedAgentAudienceWithStats(
  supabase: any,
): Promise<AudienceWithStats> {
  // 1) Verified agents visible in the Agent Network directory
  //    (canonical rule shared with /our-agents and /our-members).
  const { data: settings, error: settingsErr } = await supabase
    .from("agent_settings")
    .select("user_id, preferences_set, hide_from_directory")
    .eq("agent_status", "verified")
    .eq("hide_from_directory", false);
  if (settingsErr) throw settingsErr;
  if (!settings?.length) return { audience: [], globally_suppressed: 0 };

  const userIds = settings.map((r: any) => r.user_id);

  // 2) Must also have the agent role.
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "agent")
    .in("user_id", userIds);
  const agentRoleIds = new Set((roles || []).map((r: any) => r.user_id));

  const eligibleIds = userIds.filter((id: string) => agentRoleIds.has(id));
  if (!eligibleIds.length) return { audience: [], globally_suppressed: 0 };

  // 3) Profile fields needed to evaluate completeness + delivery.
  const { data: profiles } = await supabase
    .from("agent_profiles")
    .select("id, email, first_name, last_name, headshot_url, company")
    .in("id", eligibleIds);
  const profileMap = new Map<string, any>();
  for (const p of profiles || []) profileMap.set(p.id, p);

  // 4) Preference-source signals — Communications-Center-owned only.
  //    An agent has "Comms Center preferences" iff EITHER:
  //      (a) ≥1 row in agent_buyer_coverage_areas with source='notifications', OR
  //      (b) explicit price / property-type targeting in notification_preferences
  //          (property_types non-empty, min_price/max_price non-null, or
  //           has_no_min/has_no_max = true).
  //    Do NOT use agent_settings.preferences_set, agent_state_preferences,
  //    agent_county_preferences, profile Buyer Leads rows, or legacy/DCMLS
  //    coverage rows as a preferences-set signal. Agents whose only saved rows
  //    live in those older sources fall into the preferences-unset fallback
  //    until they deliberately configure Comms Center preferences.
  const [cov, notifPrefs] = await Promise.all([
    supabase
      .from("agent_buyer_coverage_areas")
      .select("agent_id")
      .eq("source", "notifications")
      .in("agent_id", eligibleIds),
    supabase
      .from("notification_preferences")
      .select("user_id, min_price, max_price, has_no_min, has_no_max, property_types")
      .in("user_id", eligibleIds),
  ]);

  const withPrefs = new Set<string>();
  for (const r of cov.data || []) withPrefs.add(r.agent_id);
  for (const p of (notifPrefs.data || []) as any[]) {
    const hasPropertyTypes = Array.isArray(p.property_types) && p.property_types.length > 0;
    const hasPriceBound = p.min_price != null || p.max_price != null;
    const hasDeliberateOpenBound = p.has_no_min === true || p.has_no_max === true;
    if (hasPropertyTypes || hasPriceBound || hasDeliberateOpenBound) {
      withPrefs.add(p.user_id);
    }
  }

  // 5) Global suppression — union of email_unsubscribes AND suppressed_emails.
  //    Both sources are authoritative; presence in either drops the agent.
  const emailsForSuppression = eligibleIds
    .map((id: string) => profileMap.get(id)?.email)
    .filter((e: any) => isNonEmpty(e))
    .map((e: string) => e.toLowerCase());
  const suppressed = new Set<string>();
  if (emailsForSuppression.length) {
    const [unsubsRes, suppRes] = await Promise.all([
      supabase.from("email_unsubscribes").select("email").in("email", emailsForSuppression),
      supabase.from("suppressed_emails").select("email").in("email", emailsForSuppression),
    ]);
    for (const u of unsubsRes.data || []) suppressed.add(String(u.email).toLowerCase());
    for (const u of suppRes.data || []) suppressed.add(String(u.email).toLowerCase());
  }

  const settingsById = new Map<string, any>(
    (settings || []).map((s: any) => [s.user_id, s]),
  );

  const out: EligibleAgent[] = [];
  let globally_suppressed = 0;
  for (const id of eligibleIds) {
    const profile = profileMap.get(id) || {};
    const emailRaw = typeof profile.email === "string" ? profile.email : "";
    const emailTrim = emailRaw.trim();
    const emailLc = emailTrim.toLowerCase();

    // Suppression is absolute — drop before either bucket.
    if (emailLc && suppressed.has(emailLc)) {
      globally_suppressed++;
      continue;
    }

    const has_email = isNonEmpty(emailTrim);
    // Directory profile-complete = Agent Network visibility rule:
    // first name, last name, headshot. Email is required for delivery but is
    // not part of the directory-visibility definition itself.
    const profile_complete =
      isNonEmpty(profile.first_name) &&
      isNonEmpty(profile.last_name) &&
      isNonEmpty(profile.headshot_url) &&
      has_email;

    // Communications-Center-owned preferences signal only.
    // `agent_settings.preferences_set` is intentionally NOT consulted here.
    const preferences_set = withPrefs.has(id);

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
  return { audience: out, globally_suppressed };
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