/**
 * Idempotent, retryable notification enqueue for New Developments (DRAFT 3 — not deployed).
 *
 * Review item 8 — executable behavior, not just key names:
 *  - One email_jobs row per (submission row, recipient identity), keyed by
 *      dev-lead:{lead_id}:contact:{contact_id} | dev-lead:{lead_id}:owner:{user_id}
 *      dev-showing:{id}:contact:{contact_id}   | dev-showing:{id}:owner:{user_id}
 *  - A unique-violation (23505) on idempotency_key counts as SUCCESS, never as a
 *    duplicate send and never as a reason to create a second submission row.
 *  - notified_at is stamped only when EVERY intended recipient is accounted for.
 *  - Re-running notifySubmission() for the SAME submission id is the retry path:
 *    already-enqueued recipients are skipped, missing ones are enqueued, and the
 *    stamp lands once the set is complete. `retryPendingSubmissions()` drives that
 *    same function from public.list_development_submissions_awaiting_notification().
 *
 * This module never re-enqueues an existing job, never resets a job's status, and
 * never touches any row outside the submission it was given.
 */
import {
  buildDevelopmentNotificationEmailHtml,
  buildDevelopmentNotificationSubject,
  DEVELOPMENT_LEAD_TEMPLATE,
  DEVELOPMENT_SHOWING_TEMPLATE,
  type DevelopmentNotificationInput,
} from "./buildDevelopmentNotificationEmailHtml.ts";
import {
  resolveDevelopmentRecipients,
  type DevelopmentRecipient,
} from "./developmentRecipients.ts";

export type SubmissionKind = "lead" | "showing";

const TABLE: Record<SubmissionKind, string> = {
  lead: "development_leads",
  showing: "development_showing_requests",
};

export function idempotencyKey(
  kind: SubmissionKind,
  submissionId: string,
  recipient: DevelopmentRecipient,
): string {
  const prefix = kind === "lead" ? "dev-lead" : "dev-showing";
  return `${prefix}:${submissionId}:${recipient.identityKind}:${recipient.identityId}`;
}

export interface NotifyResult {
  intended: number;
  enqueued: number;
  alreadyQueued: number;
  failed: number;
  notified: boolean;
}

export async function notifySubmission(
  supabase: any,
  kind: SubmissionKind,
  submissionId: string,
  context: Omit<DevelopmentNotificationInput, "kind" | "recipientName">,
  developmentId: string,
  accountId: string,
  replyTo: string,
): Promise<NotifyResult> {
  const recipients = await resolveDevelopmentRecipients(
    supabase,
    developmentId,
    accountId,
    kind === "lead" ? "leads" : "showings",
  );

  const result: NotifyResult = {
    intended: recipients.length,
    enqueued: 0,
    alreadyQueued: 0,
    failed: 0,
    notified: false,
  };

  if (recipients.length === 0) {
    console.warn(`[development-notify] no recipients resolved for ${kind} ${submissionId}`);
    return result;
  }

  for (const recipient of recipients) {
    const input: DevelopmentNotificationInput = {
      ...context,
      kind,
      recipientName: recipient.name,
    };

    const payload = {
      provider: "resend",
      template: kind === "lead" ? DEVELOPMENT_LEAD_TEMPLATE : DEVELOPMENT_SHOWING_TEMPLATE,
      to: recipient.email,
      subject: buildDevelopmentNotificationSubject(input),
      html: buildDevelopmentNotificationEmailHtml(input),
      reply_to: context.agentEmail,
    };

    const { error } = await supabase.from("email_jobs").insert({
      payload,
      idempotency_key: idempotencyKey(kind, submissionId, recipient),
      status: "queued",
      max_attempts: 3,
    });

    if (!error) {
      result.enqueued++;
      continue;
    }
    if (error.code === "23505") {
      // Already enqueued by an earlier attempt: success, not a duplicate send.
      result.alreadyQueued++;
      continue;
    }
    console.error(`[development-notify] enqueue failed for ${kind} ${submissionId}:`, error.message ?? error);
    result.failed++;
  }

  result.notified = result.failed === 0 && result.enqueued + result.alreadyQueued === result.intended;

  if (result.notified) {
    const { error } = await supabase
      .from(TABLE[kind])
      .update({ notified_at: new Date().toISOString() })
      .eq("id", submissionId)
      .is("notified_at", null);
    if (error) {
      console.error(`[development-notify] notified_at stamp failed for ${kind} ${submissionId}:`, error.message ?? error);
      result.notified = false;
    }
  }

  return result;
}

/**
 * Same-row retry sweep. Service-role only (the RPC enforces it).
 * Rebuilds context from the persisted row, so no request payload is required.
 */
export async function retryPendingSubmissions(
  supabase: any,
  kind: SubmissionKind,
  loadContext: (submissionId: string) => Promise<{
    context: Omit<DevelopmentNotificationInput, "kind" | "recipientName">;
    developmentId: string;
    accountId: string;
    replyTo: string;
  } | null>,
  limit = 25,
): Promise<{ processed: number; notified: number }> {
  const { data, error } = await supabase.rpc(
    "list_development_submissions_awaiting_notification",
    { _kind: kind, _limit: limit },
  );
  if (error) throw error;

  let notified = 0;
  for (const row of data ?? []) {
    const loaded = await loadContext(String(row.id));
    if (!loaded) continue;
    const res = await notifySubmission(
      supabase,
      kind,
      String(row.id),
      loaded.context,
      loaded.developmentId,
      loaded.accountId,
      loaded.replyTo,
    );
    if (res.notified) notified++;
  }
  return { processed: (data ?? []).length, notified };
}
