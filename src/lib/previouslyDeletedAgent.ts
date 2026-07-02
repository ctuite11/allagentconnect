import { supabase } from "@/integrations/supabase/client";
import type { PreviouslyDeletedAgentMatch } from "@/components/admin/PreviouslyDeletedAgentDialog";

/**
 * Phase 4 client helper — asks the admin-only edge function whether an
 * email was previously deleted as an agent. Returns the archive row or null.
 * Silent on error (returns null) so a lookup failure never blocks the admin
 * from doing their job — the server-side guard is still the authoritative
 * safety net.
 */
export async function checkDeletedAgent(
  email: string,
): Promise<PreviouslyDeletedAgentMatch | null> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const { data, error } = await supabase.functions.invoke(
      "check-deleted-agent",
      { body: { email: trimmed } },
    );
    if (error) {
      console.warn("[checkDeletedAgent] lookup error:", error);
      return null;
    }
    return (data?.match ?? null) as PreviouslyDeletedAgentMatch | null;
  } catch (err) {
    console.warn("[checkDeletedAgent] threw:", err);
    return null;
  }
}

/**
 * Records an override into audit_logs whenever an admin clicks "Continue
 * anyway" on the PreviouslyDeletedAgentDialog. Best-effort; never blocks.
 */
export async function logDeletedAgentOverride(
  match: PreviouslyDeletedAgentMatch,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      action: "previously_deleted_override",
      table_name: "deleted_users",
      record_id: match.id,
    });
  } catch (err) {
    console.warn("[logDeletedAgentOverride] failed:", err);
  }
}