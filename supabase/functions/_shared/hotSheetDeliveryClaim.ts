/**
 * Single choke point for automatic Hot Sheet email enqueue.
 *
 * Both delivery paths converge here:
 *   legacy: listing trigger -> dispatch_hot_sheet_listing (pg_net)
 *           -> notify-matching-buyers -> send-new-match-notification
 *   outbox: hot_sheet_listing_events -> process-hot-sheet-events
 *           -> send-new-match-notification
 *
 * Neither automatic path inserts into email_jobs directly. `enqueue_hot_sheet_delivery`
 * takes the logical delivery claim (listing, status, hot_sheet, audience,
 * recipient) and writes the email_jobs row in ONE transaction, so a second
 * caller for the same logical delivery gets `duplicate` and enqueues nothing —
 * regardless of which path it arrived on.
 * Manual batches have their own producer; all listing mail is also checked by
 * sendEmail immediately before delivery.
 */
import { listingEmailAllowed, listingEmailPrivacy } from "./privacyEmail.ts";
export type DeliveryClaimResult = "enqueued" | "duplicate" | "paused_held" | "privacy_blocked" | "failed";

export interface EnqueueHotSheetDeliveryArgs {
  eventId?: string | null;
  listingId: string;
  status: string;
  hotSheetId: string;
  audience: "agent" | "client" | "subscriber";
  /** Stable per-recipient identity (email, client id, or subscriber id). */
  recipientKey: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  paused: boolean;
  pauseReason?: string | null;
}

export interface DeliveryClaimOutcome {
  result: DeliveryClaimResult;
  claimId?: string | null;
  emailJobId?: string | null;
  error?: string | null;
}

// deno-lint-ignore no-explicit-any
export async function enqueueHotSheetDelivery(
  supabase: any,
  args: EnqueueHotSheetDeliveryArgs,
): Promise<DeliveryClaimOutcome> {
  const privacy = listingEmailPrivacy([args.listingId], args.hotSheetId, args.audience === "agent" ? "agent" : "external");
  if (!await listingEmailAllowed(supabase, privacy, args.payload.to)) return { result: "privacy_blocked" };
  const { data, error } = await supabase.rpc("enqueue_hot_sheet_delivery", {
    p_event_id: args.eventId ?? null,
    p_listing_id: args.listingId,
    p_status: args.status,
    p_hot_sheet_id: args.hotSheetId,
    p_audience: args.audience,
    p_recipient_key: args.recipientKey,
    p_payload: { ...args.payload, privacy },
    p_idempotency_key: args.idempotencyKey,
    p_paused: args.paused,
    p_pause_reason: args.pauseReason ?? null,
  });

  if (error) {
    return { result: "failed", error: error.message ?? String(error) };
  }

  const result = (data?.result ?? "failed") as DeliveryClaimResult;
  return {
    result,
    claimId: data?.claim_id ?? null,
    emailJobId: data?.email_job_id ?? null,
  };
}

/** A claim outcome that means "this recipient is handled" (not an error). */
export function isSettled(result: DeliveryClaimResult): boolean {
  return result === "enqueued" || result === "duplicate" || result === "paused_held" || result === "privacy_blocked";
}

/** Only a brand-new enqueue counts toward queued totals. */
export function countsAsQueued(result: DeliveryClaimResult): boolean {
  return result === "enqueued";
}
