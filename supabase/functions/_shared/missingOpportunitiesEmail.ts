// Shared builder + reserve-first enqueue for the "You're Missing Opportunities"
// service reminder sent to activated+verified agents whose profile is incomplete.
//
// The reminder is an ACCOUNT/SERVICE reminder — NOT a category notification.
// Category opt-outs (e.g. receive_buyer_alerts=false) MUST NOT suppress it.
// Global unsubscribe / suppression is enforced upstream by the audience helper.

import { buildAacEmail } from "./aacEmailTemplate.ts";
import { AAC_PUBLIC_URL } from "./aacPublicUrl.ts";

export type MissingOpportunityEventType =
  | "new_listing"
  | "client_need"
  | "client_need_county"
  | "seller_alert"
  | "broadcast";

export function buildMissingOpportunitiesEmailHtml(opts: {
  firstName?: string | null;
  baseUrl?: string;
}): string {
  const base = opts.baseUrl || AAC_PUBLIC_URL;
  const name = (opts.firstName ?? "").toString().trim() || "there";
  const profileUrl = `${base}/settings`;
  const commsUrl = `${base}/communications`;

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">Your All Agent Connect account is activated and verified — but new opportunities are passing you by.</p>
    <p style="margin:0 0 14px;">Real listing alerts, Hot Sheet matches, Buyer Needs, and Renter Needs only reach agents with a completed profile and communication preferences. Until you finish setup, these won't reach your inbox and you won't appear in the Agent Network.</p>
    <p style="margin:0 0 6px;font-weight:600;color:#0f172a;">Two quick steps unlock everything:</p>
    <ul style="margin:0 0 14px;padding-left:20px;">
      <li style="margin:0 0 6px;">Complete your <a href="${profileUrl}" style="color:#0E56F5;text-decoration:underline;">Profile &amp; Branding</a> — name, headshot, company.</li>
      <li style="margin:0 0 6px;">Set your preferences in the <a href="${commsUrl}" style="color:#0E56F5;text-decoration:underline;">Communications Center</a> — coverage, price range, categories.</li>
    </ul>
    <p style="margin:0 0 14px;">Once both are done, we'll route matching opportunities to you automatically.</p>
  `;

  return buildAacEmail({
    headline: "You're missing opportunities",
    preheader: "Complete your profile to unlock listing alerts, Hot Sheets, and Buyer Needs.",
    body,
    ctaLabel: "Complete your profile",
    ctaUrl: profileUrl,
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface ReminderEnqueueResult {
  agent_id: string;
  reserved: boolean;
  queued: boolean;
  error?: string;
}

/**
 * Reserve-first enqueue via the transactional RPC.
 * If the reservation conflicts (already reminded for this event), returns
 * reserved:false, queued:false and no email is created.
 * If the email_jobs insert fails inside the RPC, the reservation is rolled
 * back and the promise rejects — the caller can safely retry.
 */
export async function reserveAndEnqueueMissingOpportunityReminder(
  supabase: any,
  args: {
    agent_id: string;
    event_type: MissingOpportunityEventType;
    event_id: string;
    email: string;
    firstName?: string | null;
    baseUrl?: string;
  },
): Promise<ReminderEnqueueResult> {
  const idempotencyKey = `missing-opportunities:${args.event_type}:${args.event_id}:${args.agent_id}`;
  const html = buildMissingOpportunitiesEmailHtml({
    firstName: args.firstName,
    baseUrl: args.baseUrl,
  });

  const emailJob = {
    idempotency_key: idempotencyKey,
    payload: {
      provider: "resend",
      template: "agent-missing-opportunities",
      to: args.email,
      subject: "You're missing opportunities on All Agent Connect",
      category: "account_reminders",
      html,
      metadata: {
        audience: "agent",
        reason: "profile_incomplete",
        agent_id: args.agent_id,
        event_type: args.event_type,
        event_id: args.event_id,
      },
      variables: {},
    },
  };

  const { data, error } = await supabase.rpc(
    "reserve_and_enqueue_missing_opportunity_reminder",
    {
      _agent_id: args.agent_id,
      _event_type: args.event_type,
      _event_id: args.event_id,
      _email: args.email,
      _email_job: emailJob,
    },
  );

  if (error) {
    return {
      agent_id: args.agent_id,
      reserved: false,
      queued: false,
      error: error.message ?? String(error),
    };
  }
  const reserved = Boolean(data?.reserved);
  const queued = Boolean(data?.queued);
  return { agent_id: args.agent_id, reserved, queued };
}

export async function countExistingReminders(
  supabase: any,
  event_type: MissingOpportunityEventType,
  event_id: string,
  agent_ids: string[],
): Promise<Set<string>> {
  if (!agent_ids.length) return new Set();
  const { data } = await supabase
    .from("agent_missing_opportunity_reminders")
    .select("agent_id")
    .eq("event_type", event_type)
    .eq("event_id", event_id)
    .in("agent_id", agent_ids);
  return new Set((data || []).map((r: any) => String(r.agent_id)));
}