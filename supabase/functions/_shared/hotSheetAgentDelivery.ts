/**
 * Hot Sheet near-realtime agent property-notification eligibility + delivery
 * event-close rules.
 *
 * Communications Center preferences must NOT be consulted here.
 * Matching is determined by check_hot_sheet_matches + Hot Sheet flags.
 */

export type ImmediateHotSheet = {
  id: string;
  user_id: string;
  name: string;
  is_active?: boolean | null;
  notify_agent_email?: boolean | null;
  notification_schedule?: string | null;
};

export type MatchListing = {
  id: string;
  status?: string | null;
  agent_id?: string | null;
};

/** Near-realtime path only processes immediately-scheduled active sheets. */
export function isImmediateHotSheet(hotSheet: ImmediateHotSheet): boolean {
  return hotSheet.is_active !== false && hotSheet.notification_schedule === "immediately";
}

/**
 * Owning agent receives a property notification for a matched listing only when:
 * - Hot Sheet is active + immediate (caller filters)
 * - listing matched via check_hot_sheet_matches (caller supplies matches)
 * - notify_agent_email = true
 * - owner is not the listing's own agent
 */
export function isAgentEligibleForListing(
  hotSheet: ImmediateHotSheet,
  listing: MatchListing,
): boolean {
  if (hotSheet.notify_agent_email !== true) return false;
  if (!isImmediateHotSheet({ ...hotSheet, is_active: hotSheet.is_active ?? true })) {
    return false;
  }
  if (listing.agent_id && String(listing.agent_id) === String(hotSheet.user_id)) {
    return false;
  }
  return true;
}

export function agentIdempotencyKey(
  hotSheetId: string,
  listingId: string,
  status: string,
): string {
  return `hs-agent:${hotSheetId}:${listingId}:${status}`;
}

/** Per-recipient / per-listing / per-status client delivery key. */
export function clientListingIdempotencyKey(
  recipientKey: string,
  hotSheetId: string,
  listingId: string,
  status: string,
): string {
  return `hs:${recipientKey}:hs:${hotSheetId}:listing:${listingId}:${status}`;
}

/** Per-subscriber / per-listing / per-status delivery key. */
export function subscriberListingIdempotencyKey(
  subscriberId: string,
  hotSheetId: string,
  listingId: string,
  status: string,
): string {
  return `hss:${subscriberId}:hs:${hotSheetId}:listing:${listingId}:${status}`;
}

export type DeliveryOutcome = "success" | "failed" | "skipped";

/**
 * True when at least one assigned client has not accepted yet.
 * Mixed accepted/unaccepted must keep the match event open.
 */
export function hasClientsPendingAcceptance(args: {
  assignedCount: number;
  acceptedCount: number;
  /** Lookup failed — do not treat as "no clients". */
  lookupFailed?: boolean;
}): boolean {
  if (args.lookupFailed) return false;
  if (args.assignedCount <= 0) return false;
  return args.acceptedCount < args.assignedCount;
}

/**
 * Merge per-recipient outcomes for one listing into a recipient-type outcome.
 * Any failure wins; otherwise success if any success; else skipped.
 */
export function mergeRecipientOutcomes(outcomes: DeliveryOutcome[]): DeliveryOutcome {
  if (outcomes.some((o) => o === "failed")) return "failed";
  if (outcomes.some((o) => o === "success")) return "success";
  return "skipped";
}

/**
 * Close match/event state (hot_sheet_sent_listings) only when every needed
 * recipient type succeeded or was ineligible. Keeps failed recipient types
 * independently retryable.
 */
export function shouldCloseMatchEvent(args: {
  agent: DeliveryOutcome;
  client: DeliveryOutcome;
  subscriber: DeliveryOutcome;
  clientsPendingAcceptance: boolean;
}): boolean {
  const { agent, client, subscriber, clientsPendingAcceptance } = args;
  if (agent === "failed" || client === "failed" || subscriber === "failed") {
    return false;
  }
  if (clientsPendingAcceptance) return false;

  const anyDelivered =
    agent === "success" || client === "success" || subscriber === "success";
  return anyDelivered;
}

/**
 * Integration-style simulation of one matcher pass over open listings.
 * Models per-listing recipient idempotency + partial agent failure retries.
 */
export type SimulatedListing = { id: string; status: string };

export function simulateHotSheetDeliveryPass(args: {
  hotSheetId: string;
  openListings: SimulatedListing[];
  agentRecipient?: string | null;
  clientRecipients: string[];
  /** Assigned clients that have not accepted yet. */
  pendingClientRecipients?: string[];
  subscriberIds: string[];
  existingKeys: Set<string>;
  /** Listing IDs whose agent enqueue should fail on this pass. */
  failAgentListingIds?: Set<string>;
  /** Force client lookup failure for this pass. */
  clientLookupFailed?: boolean;
  /** Force subscriber lookup failure for this pass. */
  subscriberLookupFailed?: boolean;
}): {
  enqueuedKeys: string[];
  closedListingIds: string[];
  remainingOpenListingIds: string[];
  existingKeys: Set<string>;
} {
  const {
    hotSheetId,
    openListings,
    agentRecipient,
    clientRecipients,
    pendingClientRecipients = [],
    subscriberIds,
    existingKeys,
    failAgentListingIds = new Set(),
    clientLookupFailed = false,
    subscriberLookupFailed = false,
  } = args;

  const enqueuedKeys: string[] = [];
  const closedListingIds: string[] = [];
  const keys = new Set(existingKeys);

  const tryEnqueue = (key: string): DeliveryOutcome => {
    if (keys.has(key)) return "success"; // already delivered
    keys.add(key);
    enqueuedKeys.push(key);
    return "success";
  };

  const clientsPendingAcceptance = hasClientsPendingAcceptance({
    assignedCount: clientRecipients.length + pendingClientRecipients.length,
    acceptedCount: clientLookupFailed ? 0 : clientRecipients.length,
    lookupFailed: clientLookupFailed,
  });

  for (const listing of openListings) {
    const status = listing.status;

    let agent: DeliveryOutcome = "skipped";
    if (agentRecipient) {
      if (failAgentListingIds.has(listing.id)) {
        agent = "failed";
      } else {
        agent = tryEnqueue(agentIdempotencyKey(hotSheetId, listing.id, status));
      }
    }

    let client: DeliveryOutcome = "skipped";
    if (clientLookupFailed) {
      client = "failed";
    } else if (clientRecipients.length > 0) {
      const perClient: DeliveryOutcome[] = clientRecipients.map((recipientKey) =>
        tryEnqueue(clientListingIdempotencyKey(recipientKey, hotSheetId, listing.id, status))
      );
      client = mergeRecipientOutcomes(perClient);
    }

    let subscriber: DeliveryOutcome = "skipped";
    if (subscriberLookupFailed) {
      subscriber = "failed";
    } else if (subscriberIds.length > 0) {
      const perSub: DeliveryOutcome[] = subscriberIds.map((subId) =>
        tryEnqueue(subscriberListingIdempotencyKey(subId, hotSheetId, listing.id, status))
      );
      subscriber = mergeRecipientOutcomes(perSub);
    }

    if (
      shouldCloseMatchEvent({
        agent,
        client,
        subscriber,
        clientsPendingAcceptance,
      })
    ) {
      closedListingIds.push(listing.id);
    }
  }

  const closed = new Set(closedListingIds);
  return {
    enqueuedKeys,
    closedListingIds,
    remainingOpenListingIds: openListings.filter((l) => !closed.has(l.id)).map((l) => l.id),
    existingKeys: keys,
  };
}

/** Safe SQL filter identifying retired broad-pipeline property alert jobs. */
export const LEGACY_BROAD_LISTING_ALERT_JOB_FILTER = `
status IN ('queued', 'processing')
AND (
  payload->>'template' = 'agent-new-listing-alert'
  OR idempotency_key LIKE 'agent-new-listing:%'
)
`.trim();

/**
 * Preferred backlog inspection query (grouped; do not cancel processing jobs
 * unless the queue worker is paused).
 */
export const LEGACY_BROAD_LISTING_ALERT_BACKLOG_REPORT_SQL = `
SELECT
  status,
  payload->>'template' AS template,
  CASE
    WHEN idempotency_key LIKE 'agent-new-listing:%' THEN 'agent-new-listing:'
    ELSE 'other'
  END AS idempotency_prefix,
  count(*) AS job_count
FROM email_jobs
WHERE
  payload->>'template' = 'agent-new-listing-alert'
  OR idempotency_key LIKE 'agent-new-listing:%'
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
`.trim();
