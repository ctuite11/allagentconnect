import { supabase } from "@/integrations/supabase/client";

export type AgentProfileRow = Record<string, unknown> & {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  headshot_url?: string | null;
  company?: string | null;
  aac_id?: string | null;
  phone?: string | null;
};

/**
 * Resolve auth user id(s) → full `agent_profiles` row(s) for AgentIntelDrawer.
 *
 * Lookup key is the auth user id. In the current schema `agent_profiles.id`
 * is that auth id (there is no separate `auth_user_id` column). Callers must
 * still treat a miss as "not an agent / not clickable" — never invent a
 * synthetic profile, and never assume every conversation participant has a
 * row just because `resolveDisplayProfiles` flagged `isAgent`.
 */
export async function resolveAgentProfileByUserId(
  userId: string | null | undefined,
): Promise<AgentProfileRow | null> {
  if (!userId) return null;
  const map = await resolveAgentProfilesByUserIds([userId]);
  return map.get(userId) ?? null;
}

/** Batch variant — one query for many auth user ids. */
export async function resolveAgentProfilesByUserIds(
  userIds: Array<string | null | undefined>,
): Promise<Map<string, AgentProfileRow>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  const map = new Map<string, AgentProfileRow>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("agent_profiles")
    .select("*")
    .in("id", ids);

  if (error) {
    console.warn("[resolveAgentProfilesByUserIds] lookup failed", error);
    return map;
  }

  for (const row of data ?? []) {
    if (row?.id) map.set(row.id, row as AgentProfileRow);
  }
  return map;
}
