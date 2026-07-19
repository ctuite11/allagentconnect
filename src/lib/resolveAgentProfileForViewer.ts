import { supabase } from "@/integrations/supabase/client";

export type AgentProfileRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  headshot_url?: string | null;
  company?: string | null;
  office_name?: string | null;
  team_name?: string | null;
  title?: string | null;
  aac_id?: string | null;
  phone?: string | null;
  cell_phone?: string | null;
  office_phone?: string | null;
  bio?: string | null;
  created_at?: string | null;
  social_links?: unknown;
  [key: string]: unknown;
};

/**
 * Resolve auth user id(s) → full `agent_profiles` row(s) for Comms profile drawer.
 *
 * Lookup key is the auth user id. In the current schema `agent_profiles.id`
 * is that auth id (there is no separate `auth_user_id` column). Callers must
 * still treat a miss as "not an agent / not clickable" — never invent a
 * synthetic profile.
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

  // Same fields the public Agent Network / Agent Profile pages rely on.
  const { data, error } = await supabase
    .from("agent_profiles")
    .select(
      "id, aac_id, first_name, last_name, email, headshot_url, company, office_name, team_name, title, phone, cell_phone, office_phone, bio, created_at, social_links",
    )
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
