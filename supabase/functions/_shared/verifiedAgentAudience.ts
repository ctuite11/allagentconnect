// Shared canonical eligibility helper for automatic agent notifications.
//
// Canonical FULL-ACCESS rule (July 2026):
//   VERIFIED  AND  role = 'agent'  AND  (ACTIVATED OR HAS_HEADSHOT)
//     - Verified          : agent_settings.agent_status = 'verified'
//     - Activated         : agent_settings.account_activated_at IS NOT NULL
//     - Has headshot      : agent_profiles.headshot_url non-empty
//   Profile completeness (names, company, bio, phone) no longer gates email
//   eligibility. hide_from_directory no longer suppresses emails either —
//   that flag only controls Agent Network visibility, not deliverability.
//
//   Real content bucket (per-event):
//     - has_email && (preferences_set ? matches : true)
//     - Excludes senderId, explicit category opt-out, globally suppressed email
//   Reminder bucket:
//     - DEPRECATED. Always empty. The old "You're Missing Opportunities"
//       automatic reminder has been removed. Agents who are verified but not
//       activated and without a headshot are simply excluded from the audience;
//       admins reach them via the manual "Send Setup Link" action.
//   Never eligible: not verified, not (activated OR has headshot), no email,
//   globally suppressed.

import type {
  AgentPreferences,
  SavedGeoRow,
} from "./communicationPreferencesMatcher.ts";

export interface EligibleAgent {
  agent_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  preferences_set: boolean;
  /** Retained for backward compatibility. Always true — inclusion in the
   *  audience now IS the full-access gate. */
  profile_complete: boolean;
  has_email: boolean;
  /** Saved Comms-Center preferences (empty when none). */
  savedPrefs: AgentPreferences;
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
  // 1) Base population = the canonical Agent Network RPC. This is the single
  //    source of truth for who exists in the network (verified + agent role +
  //    activated + named). No independent verification / role / activation /
  //    headshot gates are evaluated here — drift between Comms and the Agent
  //    Network is impossible by construction.
  const { data: networkIds, error: rpcErr } = await supabase.rpc(
    "get_verified_agent_ids",
  );
  if (rpcErr) throw rpcErr;
  const eligibleIds: string[] = Array.from(
    new Set(
      ((networkIds || []) as any[])
        .map((r: any) => (typeof r === "string" ? r : r?.user_id))
        .filter((id: any): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  if (!eligibleIds.length) return { audience: [], globally_suppressed: 0 };

  // 2) Profile load is delivery data only: email + names.
  const { data: profiles } = await supabase
    .from("agent_profiles")
    .select("id, email, first_name, last_name")
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
      .select("agent_id, state, county, city, zip_code, neighborhood")
      .eq("source", "notifications")
      .in("agent_id", eligibleIds),
    supabase
      .from("notification_preferences")
      .select("user_id, min_price, max_price, has_no_min, has_no_max, property_types")
      .in("user_id", eligibleIds),
  ]);

  const geoByAgent = new Map<string, SavedGeoRow[]>();
  for (const r of (cov.data || []) as any[]) {
    const arr = geoByAgent.get(r.agent_id) ?? [];
    arr.push({
      state: r.state ?? null,
      county: r.county ?? null,
      city: r.city ?? null,
      zip_code: r.zip_code ?? null,
      neighborhood: r.neighborhood ?? null,
    });
    geoByAgent.set(r.agent_id, arr);
  }
  const prefsByAgent = new Map<string, any>();
  for (const p of (notifPrefs.data || []) as any[]) prefsByAgent.set(p.user_id, p);

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
    // Full-access gate already applied upstream. Retained field for
    // backward compatibility with existing partition logic.
    const profile_complete = has_email;

    // Build saved Comms-Center preferences record for the shared matcher.
    const rawPrefs = prefsByAgent.get(id) ?? {};
    const propertyTypes: string[] = Array.isArray(rawPrefs.property_types)
      ? rawPrefs.property_types.filter((t: unknown) => typeof t === "string" && t.trim().length > 0)
      : [];
    const savedPrefs: AgentPreferences = {
      geoRows: geoByAgent.get(id) ?? [],
      minPrice: rawPrefs.min_price ?? null,
      maxPrice: rawPrefs.max_price ?? null,
      hasNoMin: rawPrefs.has_no_min === true,
      hasNoMax: rawPrefs.has_no_max === true,
      propertyTypes,
    };
    // Preferences-set = ANY dimension configured. `hasNoMin`/`hasNoMax`
    // alone are not considered restrictive and do NOT flip this flag.
    const preferences_set =
      savedPrefs.geoRows.length > 0 ||
      savedPrefs.minPrice != null ||
      savedPrefs.maxPrice != null ||
      savedPrefs.propertyTypes.length > 0;

    out.push({
      agent_id: id,
      email: emailTrim,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
      preferences_set,
      profile_complete,
      has_email,
      savedPrefs,
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
  optedOut: Set<string> | undefined,
  optedIn: Set<string> | null | undefined,
): Array<T & { reason: "preferences_match" | "preferences_unset" }> {
  const out: Array<T & { reason: "preferences_match" | "preferences_unset" }> = [];
  // MANDATORY GATE: without the canonical loadCommsOptIn result there are no
  // recipients at all — including agents with configured dimensions.
  if (!optedIn) return out;
  for (const a of audience) {
    if (senderId && a.agent_id === senderId) continue;
    if (optedOut && optedOut.has(a.agent_id)) continue;
    // Legacy callers: only consider profile-complete + has-email agents.
    if (!a.profile_complete || !a.has_email) continue;
    // Opt-in policy (Aug 2026, corrected): membership in `optedIn` is the
    // authoritative explicit opt-in signal (row present + master switches on
    // + category channel true). When supplied, agents outside it are muted.
    if (!optedIn.has(a.agent_id)) continue;
    if (!a.preferences_set) {
      // Explicitly opted in, but no narrowing dimensions ⇒ intentional broad
      // opt-in for the enabled category.
      out.push({ ...a, reason: "preferences_unset" });
      continue;
    }
    if (matches(a)) out.push({ ...a, reason: "preferences_match" });
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
    /** Agents skipped because they are not explicitly opted in. */
    preferences_unset_skipped: number;
    /** Agents muted because they are outside the explicit opt-in set. */
    comms_opt_in_blocked: number;
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
  optedOut: Set<string> | undefined,
  optedIn: Set<string> | null | undefined,
): AudiencePartition<T> {
  const real: Array<T & { reason: PartitionReason }> = [];
  const reminder: T[] = [];

  let profile_complete = 0;
  let profile_incomplete = 0;
  let no_email = 0;
  let self_excluded = 0;
  let category_opted_out = 0;
  let preferences_matched = 0;
  let preferences_unset_skipped = 0;
  let preferences_unset_fallback = 0;
  let comms_opt_in_blocked = 0;
  let non_matching = 0;

  // MANDATORY GATE: an absent opt-in set yields zero real recipients,
  // regardless of configured dimensions. Callers must pass the canonical
  // loadCommsOptIn(...).allowed set.
  const gate = optedIn ?? new Set<string>();

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
      // Opt-in policy (Aug 2026, corrected).
      //   - `optedIn` (when supplied) is the authoritative explicit opt-in set:
      //     preference row present, master switches on, category channel true.
      //   - Agents outside it are muted (missing row / master off / category off).
      //   - Agents inside it with NO narrowing dimensions receive the enabled
      //     category broadly — an intentional opt-in, not the old
      //     "untouched account" fallback.
      //   - No gate supplied ⇒ fail closed for dimensionless agents.
      if (!gate.has(a.agent_id)) {
        comms_opt_in_blocked++;
        continue;
      }
      if (!a.preferences_set) {
        real.push({ ...a, reason: "preferences_unset" });
        preferences_unset_fallback++;
        continue;
      }
      if (matches(a)) {
        real.push({ ...a, reason: "preferences_match" });
        preferences_matched++;
      } else {
        non_matching++;
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
      preferences_unset_skipped,
      comms_opt_in_blocked,
      non_matching,
    },
  };
}