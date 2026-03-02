import { supabase } from "@/integrations/supabase/client";

export type DisplayProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  isAgent: boolean;
};

/**
 * Resolve display names for a set of user IDs.
 * Checks agent_profiles first, then falls back to profiles (buyers).
 */
export async function resolveDisplayProfiles(
  userIds: string[]
): Promise<Map<string, DisplayProfile>> {
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  const map = new Map<string, DisplayProfile>();
  if (ids.length === 0) return map;

  // 1) agent_profiles first
  const { data: agentRows } = await supabase
    .from("agent_profiles")
    .select("id, first_name, last_name, email")
    .in("id", ids);

  (agentRows || []).forEach((p) => {
    map.set(p.id, {
      id: p.id,
      first_name: p.first_name ?? null,
      last_name: p.last_name ?? null,
      email: p.email ?? null,
      isAgent: true,
    });
  });

  // 2) profiles fallback (buyers)
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const { data: buyerRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", missing);

    (buyerRows || []).forEach((p) => {
      map.set(p.id, {
        id: p.id,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        email: p.email ?? null,
        isAgent: false,
      });
    });
  }

  return map;
}
