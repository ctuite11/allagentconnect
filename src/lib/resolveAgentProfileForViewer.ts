import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve an auth user id to a full `agent_profiles` row for the AgentIntelDrawer.
 *
 * `agent_profiles.id` is the canonical auth user id in this schema (no separate
 * `auth_user_id`/`user_id` column exists), so callers pass a `senderId`/`userId`
 * and get either the row or null. Buyers and non-agent participants resolve to
 * null, which callers use as the "not clickable / unresolved" signal.
 */
export async function resolveAgentProfileByUserId(userId: string | null | undefined) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("agent_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[resolveAgentProfileByUserId] lookup failed", error);
    return null;
  }
  return data ?? null;
}