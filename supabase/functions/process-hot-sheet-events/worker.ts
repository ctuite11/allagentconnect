/**
 * Testable core of the durable Hot Sheet outbox worker.
 *
 * Deliberately free of Deno.serve / Supabase client construction so every
 * behaviour that matters is directly assertable:
 *   - paused  -> claims NOTHING (events stay `pending`, never terminal)
 *   - success -> event completed as `processed` under its own lease
 *   - failure -> event failed (retry/backoff owned by the RPC)
 *   - the worker never marks an event terminal on behalf of another worker
 */
export interface OutboxEvent {
  id: string;
  listing_id: string;
  new_status?: string | null;
  attempts?: number | null;
}

export interface PauseGate {
  paused: boolean;
  reason?: string;
  switch?: string;
}

export interface MatcherResponse {
  data?: { paused?: boolean; jobsQueued?: number } | null;
  error?: { message?: string } | null;
}

export interface WorkerDeps {
  pauseGate: PauseGate;
  workerId: string;
  limit: number;
  leaseSeconds: number;
  claimEvents: (args: {
    limit: number;
    workerId: string;
    leaseSeconds: number;
  }) => Promise<{ events: OutboxEvent[]; error?: string | null }>;
  invokeMatcher: (event: OutboxEvent) => Promise<MatcherResponse>;
  completeEvent: (eventId: string, workerId: string, state: string) => Promise<boolean>;
  failEvent: (eventId: string, workerId: string, error: string) => Promise<boolean>;
  logStage?: (
    eventId: string,
    listingId: string,
    stage: string,
    outcome: string,
    detail: Record<string, unknown>,
  ) => Promise<void>;
}

export interface WorkerResult {
  status: number;
  body: Record<string, unknown>;
}

export async function runHotSheetOutboxWorker(deps: WorkerDeps): Promise<WorkerResult> {
  const {
    pauseGate,
    workerId,
    limit,
    leaseSeconds,
    claimEvents,
    invokeMatcher,
    completeEvent,
    failEvent,
    logStage,
  } = deps;

  // While paused the worker does not claim at all. Claiming would burn an
  // attempt and risk marking a real obligation terminal before it can ever be
  // delivered; events must simply wait, untouched, until sending reopens.
  if (pauseGate.paused) {
    return {
      status: 200,
      body: {
        paused: true,
        switch: pauseGate.switch,
        reason: pauseGate.reason,
        claimed: 0,
        processed: 0,
        failed: 0,
      },
    };
  }

  const { events, error: claimError } = await claimEvents({ limit, workerId, leaseSeconds });
  if (claimError) {
    return {
      status: 500,
      body: { success: false, error: claimError, claimed: 0, processed: 0, failed: 0 },
    };
  }

  let processed = 0;
  let failed = 0;
  let jobsQueued = 0;
  let lostLease = 0;

  for (const event of events ?? []) {
    const stage = (outcome: string, detail: Record<string, unknown>) =>
      logStage?.(event.id, event.listing_id, "worker_dispatch", outcome, detail).catch(() => {});

    try {
      const { data, error } = await invokeMatcher(event);

      if (error) {
        failed += 1;
        await failEvent(event.id, workerId, error.message ?? String(error));
        await stage("failed", { error: error.message ?? String(error) });
        continue;
      }

      // The matcher re-reads the pause switch itself. If it reports paused, the
      // event is NOT consumed — leave it retryable rather than terminal.
      if (data?.paused) {
        failed += 1;
        await failEvent(event.id, workerId, "matcher_paused");
        await stage("deferred", { reason: "matcher_paused" });
        continue;
      }

      jobsQueued += Number(data?.jobsQueued ?? 0);
      const completed = await completeEvent(event.id, workerId, "processed");
      if (!completed) lostLease += 1;
      else processed += 1;
      await stage(completed ? "processed" : "lease_lost", {
        jobs_queued: Number(data?.jobsQueued ?? 0),
      });
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      await failEvent(event.id, workerId, message);
      await stage("failed", { error: message });
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      worker_id: workerId,
      claimed: (events ?? []).length,
      processed,
      failed,
      lost_lease: lostLease,
      jobs_queued: jobsQueued,
    },
  };
}
