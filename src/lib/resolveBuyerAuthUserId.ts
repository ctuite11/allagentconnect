import { supabase } from "@/integrations/supabase/client";

/**
 * Buyer auth UUID for favorites, conversations, and agent mirror surfaces.
 * Resolve from `profiles` using the CRM client's email (same as `useBuyerWorkspaceMirror` / `AgentClientFavorites`).
 * Do not use `clients.agent_user_id` — it is legacy and not authoritative.
 */
export async function resolveBuyerAuthUserId(client: { email: string }): Promise<string | null> {
  const email = client.email?.trim();
  if (!email) return null;
  const { data: exact } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (exact?.id) return String(exact.id);
  const { data: loose } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email.toLowerCase())
    .maybeSingle();
  return loose?.id ? String(loose.id) : null;
}
