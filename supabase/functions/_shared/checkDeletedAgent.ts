/**
 * Phase 4 guardrail helper — looks up a deletion that still applies to the
 * current account for an email. Historical tombstones predating a legitimate
 * replacement account are intentionally ignored.
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
  const { data, error } = await admin.rpc("find_current_agent_deletion", {
    p_email: target,
  });
  if (error) {
    console.error("[findDeletedAgent] lookup error:", error.message);
    return null;
  }
  return ((Array.isArray(data) ? data[0] : data) ?? null) as DeletedAgentMatch | null;
}