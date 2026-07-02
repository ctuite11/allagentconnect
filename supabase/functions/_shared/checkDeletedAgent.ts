/**
 * Phase 4 guardrail helper — looks up the most recent deleted_users row for
 * an email. Used by every admin path that creates, verifies, or emails an
 * agent so we cannot silently rebuild a previously-deleted agent (and
 * re-fire the License Verified email) without an explicit admin override.
 *
 * Scope note: `deleted_users` only ever contains agent archives (populated
 * by DeleteAgentDialog / BulkDeleteAgentsDialog). Buyer/consumer flows and
 * the CRM `clients` table are unaffected.
 */

export interface DeletedAgentMatch {
  id: string;
  original_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  deleted_at: string;
  deleted_by: string | null;
  deletion_reason: string | null;
}

// deno-lint-ignore no-explicit-any
export async function findDeletedAgent(
  admin: any,
  email: string,
): Promise<DeletedAgentMatch | null> {
  const target = (email ?? "").trim().toLowerCase();
  if (!target) return null;
  const { data, error } = await admin
    .from("deleted_users")
    .select(
      "id,original_user_id,email,first_name,last_name,deleted_at,deleted_by,deletion_reason",
    )
    .ilike("email", target)
    .order("deleted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[findDeletedAgent] lookup error:", error.message);
    return null;
  }
  return (data ?? null) as DeletedAgentMatch | null;
}