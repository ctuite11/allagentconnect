/**
 * Hot Sheet event classification.
 *
 * The durable event row (`hot_sheet_listing_events`) is the ONLY source of
 * truth for whether a delivery is an initial publication ("New Match") or a
 * later status transition ("Status Change").
 *
 * `hot_sheet_sent_listings` and `hot_sheet_delivery_claims` remain dedupe
 * state only — they must never decide the event type, because both delivery
 * paths (legacy pg_net kick and durable outbox) can race and the first one
 * through the claim would permanently win with the wrong template.
 *
 * Rules:
 *   INSERT into a deliverable status      -> new_match
 *   UPDATE from 'draft'                   -> new_match  (real AAC publish flow)
 *   UPDATE where old_status = new_status  -> skip       (regression fingerprint)
 *   UPDATE, any other real transition     -> status_change
 *   missing / mismatched event context    -> skip       (fail closed)
 */
export type HotSheetEventClass = "new_match" | "status_change" | "skip";

export interface HotSheetEventContext {
  id?: string | null;
  listing_id?: string | null;
  trigger_op?: string | null;
  old_status?: string | null;
  new_status?: string | null;
}

export interface HotSheetEventClassification {
  eventClass: HotSheetEventClass;
  reason: string;
}

const norm = (v: unknown): string => String(v ?? "").trim().toLowerCase();

export function classifyHotSheetEvent(
  event: HotSheetEventContext | null | undefined,
  requestedListingId: string,
): HotSheetEventClassification {
  if (!event || !event.id) {
    return { eventClass: "skip", reason: "missing_event_context" };
  }

  if (norm(event.listing_id) !== norm(requestedListingId)) {
    // One event id may never classify a different listing.
    return { eventClass: "skip", reason: "event_listing_mismatch" };
  }

  const op = norm(event.trigger_op);
  const oldStatus = norm(event.old_status);
  const newStatus = norm(event.new_status);

  if (!newStatus) {
    return { eventClass: "skip", reason: "missing_new_status" };
  }

  if (op === "insert") {
    return { eventClass: "new_match", reason: "insert" };
  }

  if (op === "update") {
    if (!oldStatus) {
      return { eventClass: "skip", reason: "missing_old_status" };
    }
    if (oldStatus === newStatus) {
      return { eventClass: "skip", reason: "same_status_update" };
    }
    if (oldStatus === "draft") {
      return { eventClass: "new_match", reason: "initial_publication_from_draft" };
    }
    return { eventClass: "status_change", reason: "status_transition" };
  }

  return { eventClass: "skip", reason: "unknown_trigger_op" };
}

// ---------------------------------------------------------------------------
// Event-status authority + superseded-event safety.
//
// For a durable Hot Sheet event, the event's `new_status` is the ONLY status
// the delivery may use: subject/statusKey, delivery-claim status, email
// idempotency status component, `status_at_send`, and sent-state. The
// listing's CURRENT status is consulted for exactly one thing — detecting
// that the event has already been superseded by a later transition
// (e.g. active -> off_market -> active before the worker ran). A superseded
// event sends nothing: its email would already be false on arrival.
// ---------------------------------------------------------------------------
import { normalizeStatusKey, type HotSheetStatusKey } from "./hotSheetStatusCopy.ts";

export type HotSheetEventDeliveryPlan =
  | { action: "skip"; reason: string }
  | {
    action: "deliver";
    eventClass: "new_match" | "status_change";
    /** Raw event status (event.new_status, trimmed). */
    status: string;
    statusKey: HotSheetStatusKey;
  };

export function isEventSuperseded(
  eventNewStatus: unknown,
  currentListingStatus: unknown,
): boolean {
  return norm(eventNewStatus) !== norm(currentListingStatus);
}

export function planHotSheetEventDelivery(
  event: HotSheetEventContext | null | undefined,
  requestedListingId: string,
  currentListingStatus: string | null | undefined,
): HotSheetEventDeliveryPlan {
  const classification = classifyHotSheetEvent(event, requestedListingId);
  if (classification.eventClass === "skip") {
    return { action: "skip", reason: classification.reason };
  }
  if (currentListingStatus == null || norm(currentListingStatus) === "") {
    return { action: "skip", reason: "listing_missing" };
  }
  if (isEventSuperseded(event!.new_status, currentListingStatus)) {
    return { action: "skip", reason: "event_superseded" };
  }
  const status = String(event!.new_status).trim();
  return {
    action: "deliver",
    eventClass: classification.eventClass,
    status,
    statusKey: normalizeStatusKey(status),
  };
}
