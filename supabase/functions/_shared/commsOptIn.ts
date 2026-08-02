/**
 * Communications Center opt-in gate (permanent policy, Aug 2026).
 *
 * Policy:
 *   - Comms Center email is OPT-IN ONLY.
 *   - A missing `notification_preferences` row means EVERYTHING off:
 *     no immediate email, no daily digest, no weekly digest.
 *   - `client_needs_enabled` and `new_matches_enabled` are master switches;
 *     either being false (or missing) mutes all Comms Center delivery.
 *   - The applicable category channel must be explicitly true.
 *
 * Scope: Comms Center broadcasts ONLY. Transactional, activation,
 * password/account, direct-message and Hot Sheet email are unaffected and
 * must never call through this module.
 */

export type CommsCategoryColumn =
  | "buyer_need"
  | "renter_need"
  | "sales_intel"
  | "general_discussion";

export type CommsPrefsRow = {
  user_id?: string;
  buyer_need?: boolean | null;
  renter_need?: boolean | null;
  sales_intel?: boolean | null;
  general_discussion?: boolean | null;
  client_needs_enabled?: boolean | null;
  new_matches_enabled?: boolean | null;
} | null | undefined;

export type OptInDecision = {
  allowed: boolean;
  reason:
    | "allowed"
    | "missing_row"
    | "client_needs_disabled"
    | "new_matches_disabled"
    | "category_off";
};

const PREFS_COLUMNS =
  "user_id, buyer_need, renter_need, sales_intel, general_discussion, client_needs_enabled, new_matches_enabled";

/**
 * Pure decision function. `requireNewMatches` defaults to true because every
 * current Comms Center broadcast surface is gated by both master switches.
 */
export function evaluateCommsOptIn(
  row: CommsPrefsRow,
  category: CommsCategoryColumn,
  requireNewMatches = true,
): OptInDecision {
  if (!row) return { allowed: false, reason: "missing_row" };
  if (row.client_needs_enabled !== true) {
    return { allowed: false, reason: "client_needs_disabled" };
  }
  if (requireNewMatches && row.new_matches_enabled !== true) {
    return { allowed: false, reason: "new_matches_disabled" };
  }
  if (row[category] !== true) return { allowed: false, reason: "category_off" };
  return { allowed: true, reason: "allowed" };
}

export type SupabaseLike = { from: (table: string) => any };

export type OptInLookup = {
  /** Agents explicitly opted in for this category. */
  allowed: Set<string>;
  /** Every agent id that was blocked, with the reason. */
  blocked: Map<string, OptInDecision["reason"]>;
  /** Raw rows keyed by user_id (missing agents are absent). */
  rows: Map<string, NonNullable<CommsPrefsRow>>;
};

/**
 * Batch opt-in lookup. Fails CLOSED: a lookup error mutes everyone, because
 * silence is always safer than an unwanted broadcast.
 */
export async function loadCommsOptIn(
  supabase: SupabaseLike,
  agentIds: string[],
  category: CommsCategoryColumn,
  requireNewMatches = true,
): Promise<OptInLookup> {
  const ids = Array.from(new Set(agentIds.filter(Boolean)));
  const allowed = new Set<string>();
  const blocked = new Map<string, OptInDecision["reason"]>();
  const rows = new Map<string, NonNullable<CommsPrefsRow>>();
  if (ids.length === 0) return { allowed, blocked, rows };

  const { data, error } = await supabase
    .from("notification_preferences")
    .select(PREFS_COLUMNS)
    .in("user_id", ids);

  if (error) {
    console.error("[loadCommsOptIn] lookup failed — muting all (fail closed)", error);
    for (const id of ids) blocked.set(id, "missing_row");
    return { allowed, blocked, rows };
  }

  for (const r of (data || []) as Array<NonNullable<CommsPrefsRow>>) {
    if (r?.user_id) rows.set(r.user_id, r);
  }

  for (const id of ids) {
    const decision = evaluateCommsOptIn(rows.get(id) ?? null, category, requireNewMatches);
    if (decision.allowed) allowed.add(id);
    else blocked.set(id, decision.reason);
  }
  return { allowed, blocked, rows };
}

/** Single-agent re-read used at digest send time. */
export async function reloadCommsOptIn(
  supabase: SupabaseLike,
  agentId: string,
  category: CommsCategoryColumn,
  requireNewMatches = true,
): Promise<OptInDecision> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(PREFS_COLUMNS)
    .eq("user_id", agentId)
    .maybeSingle();
  if (error) {
    console.error("[reloadCommsOptIn] lookup failed — muting (fail closed)", error);
    return { allowed: false, reason: "missing_row" };
  }
  return evaluateCommsOptIn(data ?? null, category, requireNewMatches);
}

/** Maps a free-form broadcast category label to its preference column. */
export function categoryColumnFor(label: string | null | undefined): CommsCategoryColumn {
  const v = (label || "").toLowerCase();
  if (v.includes("rent")) return "renter_need";
  if (v.includes("sales") || v.includes("intel")) return "sales_intel";
  if (v.includes("general") || v.includes("discussion")) return "general_discussion";
  return "buyer_need";
}
