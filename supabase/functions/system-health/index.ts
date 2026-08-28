/**
 * AAC Production Monitoring — Phase 1
 *
 * Machine-readable production health endpoint for an EXTERNAL uptime service.
 *
 * - Auth: dedicated `SYSTEM_HEALTH_MONITOR_TOKEN` bearer only. User/anon JWTs
 *   are never accepted.
 * - Reads: one read-only RPC (`public.get_system_health`). No writes ever.
 * - Response: metrics only — counts, ages, timestamps, cron job names/status.
 *   No PII, no payloads, no recipients, no cron command text.
 * - Pause awareness lives HERE, because pause switches are Edge Function
 *   environment secrets that Postgres cannot read.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { timingSafeEqual } from "../_shared/commsDigestCronAuth.ts";
import {
  ALL_STREAMS,
  type EmailStream,
  isGloballyPaused,
  isStreamPaused,
} from "../_shared/emailStreams.ts";
import { extractBearerToken } from "../_shared/internalServiceRoleAuth.ts";

const MONITOR_TOKEN_ENV = "SYSTEM_HEALTH_MONITOR_TOKEN";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Status = "healthy" | "degraded" | "critical" | "paused";

const RANK: Record<Status, number> = { healthy: 0, paused: 1, degraded: 2, critical: 3 };

/** Worst genuine (unpaused) status wins; `paused` never masks a real failure. */
function rollup(statuses: Status[]): Status {
  let worst: Status = "healthy";
  for (const s of statuses) if (RANK[s] > RANK[worst]) worst = s;
  return worst;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ---------------- thresholds ---------------- */

const CRON_DEGRADED_S = 5 * 60;
const CRON_CRITICAL_S = 10 * 60;

const QUEUE_AGE_DEGRADED_S = 10 * 60;
const QUEUE_AGE_CRITICAL_S = 30 * 60;
const STUCK_AGE_DEGRADED_S = 15 * 60;
const STUCK_AGE_CRITICAL_S = 60 * 60;
const FAILED_DEGRADED = 10;
const FAILED_CRITICAL = 25;

const OUTBOX_AGE_DEGRADED_S = 15 * 60;
const OUTBOX_AGE_CRITICAL_S = 60 * 60;

type CronEntry = {
  active: boolean;
  schedule: string;
  last_successful_run_at: string | null;
  seconds_since_success: number | null;
  last_run_at: string | null;
  last_run_status: string | null;
};

function cronStatus(entry: CronEntry | undefined): Status {
  if (!entry) return "critical";
  if (!entry.active) return "paused"; // intentionally disabled, not broken
  const age = entry.seconds_since_success;
  if (age === null) return "critical";
  if (age > CRON_CRITICAL_S) return "critical";
  if (age > CRON_DEGRADED_S) return "degraded";
  return "healthy";
}

type StreamMetrics = {
  queued_count: number;
  due_queued_count: number;
  oldest_due_age_seconds: number;
  processing_count: number;
  stuck_processing_count: number;
  oldest_processing_age_seconds: number;
  recent_failed_count: number;
};

function streamStatus(m: StreamMetrics): Status {
  if (
    m.oldest_due_age_seconds > QUEUE_AGE_CRITICAL_S ||
    (m.stuck_processing_count > 0 && m.oldest_processing_age_seconds > STUCK_AGE_CRITICAL_S) ||
    m.recent_failed_count >= FAILED_CRITICAL
  ) return "critical";
  if (
    m.oldest_due_age_seconds > QUEUE_AGE_DEGRADED_S ||
    (m.stuck_processing_count > 0 && m.oldest_processing_age_seconds > STUCK_AGE_DEGRADED_S) ||
    m.recent_failed_count >= FAILED_DEGRADED
  ) return "degraded";
  return "healthy";
}

Deno.serve(async (req) => {
  const startedAt = Date.now();

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  /* ---- monitor-token authorization (fail closed, discloses nothing) ---- */
  const expected = (Deno.env.get(MONITOR_TOKEN_ENV) ?? "").trim();
  if (!expected) return json({ error: "misconfigured" }, 503);

  const provided =
    extractBearerToken(req.headers.get("Authorization")) ??
    (req.headers.get("x-system-health-token") ?? "").trim();
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "misconfigured" }, 503);

  const checkedAt = new Date().toISOString();

  let snapshot: Record<string, unknown> | null = null;
  let dbError: string | null = null;
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await supabase.rpc("get_system_health");
    if (error) dbError = error.message;
    else snapshot = data as Record<string, unknown>;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  if (!snapshot) {
    return json({
      status: "critical",
      checked_at: checkedAt,
      response_time_ms: Date.now() - startedAt,
      database: { status: "critical", error: dbError ? "health_query_failed" : "no_data" },
    }, 503);
  }

  const cron = (snapshot.cron ?? {}) as Record<string, CronEntry>;
  const queueStreams = (
    (snapshot.email_queue as { streams?: Record<string, StreamMetrics> } | undefined)?.streams ?? {}
  ) as Record<string, StreamMetrics>;
  const outbox = (snapshot.hot_sheet_outbox ?? {}) as {
    pending_count: number;
    oldest_pending_age_seconds: number;
    claimed_count: number;
    lease_expired_count: number;
    paused_held_count: number;
    recent_failed_count: number;
  };

  const globalPaused = isGloballyPaused();

  /* ---- email queue, per stream, pause-aware ---- */
  const streamsOut: Record<string, unknown> = {};
  const genuineStreamStatuses: Status[] = [];
  let anyStreamPaused = false;

  for (const stream of ALL_STREAMS as EmailStream[]) {
    const m: StreamMetrics = queueStreams[stream] ?? {
      queued_count: 0,
      due_queued_count: 0,
      oldest_due_age_seconds: 0,
      processing_count: 0,
      stuck_processing_count: 0,
      oldest_processing_age_seconds: 0,
      recent_failed_count: 0,
    };
    const paused = globalPaused || isStreamPaused(stream);
    const status: Status = paused ? "paused" : streamStatus(m);
    if (paused) anyStreamPaused = true;
    else genuineStreamStatuses.push(status);
    streamsOut[stream] = { status, paused, ...m };
  }

  const emailQueueStatus: Status = genuineStreamStatuses.length
    ? rollup(genuineStreamStatuses)
    : "paused";

  /* ---- email worker heartbeat (cron, not last-email-sent) ---- */
  const workerJob = cron["process-email-queue-every-minute"];
  const emailWorkerStatus: Status = cronStatus(workerJob);

  /* ---- Hot Sheets: event-driven producers + scheduled outbox drainer ---- */
  const hsJob = cron["process-hot-sheet-events-every-minute"];
  const hsCronStatus = cronStatus(hsJob);
  const hsPaused = globalPaused || isStreamPaused("hot_sheet");
  let backlogStatus: Status = "healthy";
  if (!hsPaused) {
    if (
      outbox.oldest_pending_age_seconds > OUTBOX_AGE_CRITICAL_S ||
      outbox.lease_expired_count > 0
    ) backlogStatus = "critical";
    else if (outbox.oldest_pending_age_seconds > OUTBOX_AGE_DEGRADED_S) backlogStatus = "degraded";
  }
  // The drainer itself must keep running even while email delivery is paused
  // (it holds events as `paused_held` rather than dropping them).
  const hotSheetStatus: Status = rollup([hsCronStatus, backlogStatus]);

  const digestJob = cron["process-comms-digests"];
  const digestStatus: Status = (() => {
    if (!digestJob) return "critical";
    if (!digestJob.active) return "paused";
    const age = digestJob.seconds_since_success;
    if (age === null) return "critical";
    if (age > 45 * 60) return "critical";
    if (age > 25 * 60) return "degraded";
    return "healthy";
  })();

  const topLevel = rollup([
    "healthy" as Status, // database reachable
    emailQueueStatus,
    emailWorkerStatus,
    hotSheetStatus,
    digestStatus,
    anyStreamPaused || globalPaused ? "paused" : "healthy",
  ]);

  const body = {
    status: topLevel,
    checked_at: checkedAt,
    response_time_ms: Date.now() - startedAt,
    database: { status: "healthy" },
    email_delivery_paused: globalPaused,
    email_queue: { status: emailQueueStatus, streams: streamsOut },
    email_worker: {
      status: emailWorkerStatus,
      job: "process-email-queue-every-minute",
      active: workerJob?.active ?? false,
      schedule: workerJob?.schedule ?? null,
      last_successful_run_at: workerJob?.last_successful_run_at ?? null,
      seconds_since_success: workerJob?.seconds_since_success ?? null,
      last_run_at: workerJob?.last_run_at ?? null,
      last_run_status: workerJob?.last_run_status ?? null,
    },
    hot_sheets: {
      status: hotSheetStatus,
      mode: "event_driven_outbox_drain",
      emails_paused: hsPaused,
      worker: {
        status: hsCronStatus,
        job: "process-hot-sheet-events-every-minute",
        active: hsJob?.active ?? false,
        schedule: hsJob?.schedule ?? null,
        last_successful_run_at: hsJob?.last_successful_run_at ?? null,
        seconds_since_success: hsJob?.seconds_since_success ?? null,
        last_run_at: hsJob?.last_run_at ?? null,
        last_run_status: hsJob?.last_run_status ?? null,
      },
      outbox: { status: backlogStatus, ...outbox },
    },
    comms_digests: {
      status: digestStatus,
      job: "process-comms-digests",
      active: digestJob?.active ?? false,
      last_successful_run_at: digestJob?.last_successful_run_at ?? null,
      seconds_since_success: digestJob?.seconds_since_success ?? null,
      last_run_at: digestJob?.last_run_at ?? null,
      last_run_status: digestJob?.last_run_status ?? null,
    },
    inactive_cron_jobs: snapshot.inactive_cron_jobs ?? [],
    notes: {
      stuck_processing_metric:
        "approximate: email_jobs has no claim timestamp; age measured from created_at",
    },
  };

  return json(body, topLevel === "critical" ? 503 : 200);
});
