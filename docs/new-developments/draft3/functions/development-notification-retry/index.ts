// @auth-classification: service-role-internal
/**
 * development-notification-retry (DRAFT 3 — NOT DEPLOYED).
 *
 * Review item 3: the production caller for retryPendingSubmissions().
 *
 * Internal only. Callers must present the exact service-role key
 * (`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`); ordinary user/anon JWTs
 * are rejected 401 by authorizeInternalServiceRole(). Intended caller is the
 * Postgres dispatcher public.invoke_development_notification_retry() (migration
 * 11), driven by pg_cron once the rollout canary is approved.
 *
 * Behavior guarantees:
 *  - Operates only on rows the RPC returns: notified_at IS NULL on an ACTIVE
 *    development account. It never inserts a lead/showing.
 *  - Rebuilds context from the persisted row, so it retries the SAME submission
 *    id; already-enqueued recipients hit the unique idempotency_key and count
 *    as success (23505), so no duplicate email is ever enqueued.
 *  - Re-verifies development publish/account state before enqueuing, so a
 *    development whose account was disabled after submission is skipped and
 *    simply stays unnotified.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeInternalServiceRole } from "../_shared/internalServiceRoleAuth.ts";
import {
  retryPendingSubmissions,
  type SubmissionKind,
} from "../_shared/developmentNotify.ts";

const ROUTE = "development-notification-retry";
const KINDS: SubmissionKind[] = ["lead", "showing"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = authorizeInternalServiceRole(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary: Record<string, { processed: number; notified: number }> = {};

  for (const kind of KINDS) {
    try {
      summary[kind] = await retryPendingSubmissions(
        admin,
        kind,
        (submissionId) => loadContext(admin, kind, submissionId),
        25,
      );
    } catch (err) {
      console.error(`[${ROUTE}] ${kind} sweep failed:`, err instanceof Error ? err.message : String(err));
      summary[kind] = { processed: 0, notified: 0 };
    }
  }

  return json({ success: true, summary });
});

/** Rebuild the notification context from persisted rows only. */
async function loadContext(
  admin: any,
  kind: SubmissionKind,
  submissionId: string,
) {
  const table = kind === "lead" ? "development_leads" : "development_showing_requests";
  const nameCols = kind === "lead"
    ? "sender_name, sender_email, sender_phone"
    : "requester_name, requester_email, requester_phone, preferred_date, preferred_time";

  const { data: row, error: rowError } = await admin
    .from(table)
    .select(`id, development_id, account_id, unit_id, message, created_at, notified_at, ${nameCols}`)
    .eq("id", submissionId)
    .maybeSingle();
  if (rowError) {
    console.error(`[${ROUTE}] row load failed for ${kind} ${submissionId}:`, rowError.message);
    return null;
  }
  if (!row || row.notified_at) return null;

  // Re-verify account state independently of the RPC filter.
  const { data: development, error: developmentError } = await admin
    .from("developments")
    .select("id, account_id, name, slug, development_accounts!inner(is_active)")
    .eq("id", row.development_id)
    .maybeSingle();
  if (developmentError) {
    console.error(`[${ROUTE}] development load failed for ${kind} ${submissionId}:`, developmentError.message);
    return null;
  }
  if (!development || (development as any).development_accounts?.is_active !== true) return null;

  let unitLabel: string | null = null;
  if (row.unit_id) {
    const { data: unit } = await admin
      .from("development_units")
      .select("unit_number, development_id")
      .eq("id", row.unit_id)
      .maybeSingle();
    if (unit && unit.development_id === development.id) unitLabel = unit.unit_number ?? null;
  }

  const agentName = kind === "lead" ? row.sender_name : row.requester_name;
  const agentEmail = kind === "lead" ? row.sender_email : row.requester_email;
  const agentPhone = kind === "lead" ? row.sender_phone : row.requester_phone;

  return {
    context: {
      developmentName: development.name,
      developmentId: development.id,
      developmentSlug: development.slug,
      unitLabel,
      agentName,
      agentEmail,
      agentPhone: agentPhone ?? null,
      agentBrokerage: null,
      message: row.message ?? null,
      preferredDate: kind === "showing" ? (row.preferred_date ?? null) : null,
      preferredTime: kind === "showing" ? (row.preferred_time ?? null) : null,
      submittedAt: new Date(row.created_at).toUTCString(),
    },
    developmentId: development.id,
    accountId: development.account_id,
    replyTo: agentEmail,
  };
}
