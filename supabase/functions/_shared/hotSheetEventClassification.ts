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
