# AAC Production Monitoring — Phase 1

Observation-only health endpoint for an external uptime service. No business logic, no sends, no synthetic records.

## Audit findings (live production, verified now)

Active cron jobs:
- `process-email-queue-every-minute` (jobid 2) — `* * * * *`, calls `public.invoke_process_email_queue()`. ACTIVE, succeeding every minute.
- `process-hot-sheet-events-every-minute` (jobid 11) — `* * * * *`, calls `public.invoke_process_hot_sheet_events()`. ACTIVE. Hot Sheet matching is **event-driven with a scheduled outbox drainer**: DB triggers write to `hot_sheet_listing_events`, and this cron drains the outbox.
- `process-comms-digests` (jobid 9) — `*/15 * * * *`. ACTIVE.
- `update-listing-statuses-every-1-min` (jobid 6), `process-auth-deletion-queue` (jobid 8) — ACTIVE.

Inactive (will NOT be reactivated and will NOT be treated as broken):
- `send-new-match-notification-every-15-min` (jobid 3), `process-pending-message-emails` (4), `send-price-change-notification-every-15-min` (5), `send-stale-listing-reminders-daily` (7).

Email queue model (`public.email_jobs`): statuses seen today are `sent`, `failed`, `cancelled`; live states also include `queued` and `processing`. Timestamps available: `created_at`, `run_after`, `delivery_status_at`. Retry semantics live in `email_jobs_claim(p_limit, p_streams)` — claims `queued` rows with `run_after <= now()`, flips to `processing`, increments `attempts`.

Important discrepancies to design around:
1. `email_jobs` has **no claim timestamp / updated_at**, so "stuck processing" can only be approximated by `created_at` age plus `attempts`. Phase 1 will report `stuck_processing_count` using an age-based proxy and label it as approximate. No schema change is proposed unless you approve one later.
2. Email sending has intentional pause switches (`EMAIL_SENDING_PAUSED`, per-stream pauses). A paused system must report `paused`, not `critical`, so monitoring never pressures anyone to unpause.
3. `cron.job_run_details` is populated and usable for real last-run/last-success per job.

## 1. Migration: `get_system_health` RPC

New migration `YYYYMMDDHHMM_add_get_system_health.sql`:
- `public.get_system_health()` — `SECURITY DEFINER` (needed to read `cron.job` / `cron.job_run_details`), `STABLE`, `SET search_path = public, pg_catalog`, read-only, returns a single `jsonb`.
- `REVOKE ALL ... FROM PUBLIC, anon, authenticated;` `GRANT EXECUTE ... TO service_role;`
- Returns counts/ages/timestamps only. No emails, names, IDs, payloads, or cron command text.

Signals returned:
- `database`: trivially healthy if the RPC returns.
- `email_queue`: `queued_count`, `oldest_queued_age_seconds` (only rows with `run_after <= now()`), `processing_count`, `stuck_processing_count` (approx, `created_at` older than the stuck window), `recent_failed_count` (last 15 min).
- `email_worker`: from `cron.job_run_details` for jobid of `process-email-queue-every-minute` — `last_successful_run_at`, `seconds_since_success`, `active` flag.
- `hot_sheets`: `mode: "event_driven_outbox_drain"`, cron `last_successful_run_at` / `seconds_since_success` for `process-hot-sheet-events-every-minute`, plus outbox backlog: `pending_count` and `oldest_pending_age_seconds` from `hot_sheet_listing_events` where `state` is not terminal, and `lease_expired_count`.
- `comms_digests`: cron last-success age (15-min cadence).

## 2. Edge Function `system-health`

`supabase/functions/system-health/index.ts`:
- Requires `Authorization: Bearer <SYSTEM_HEALTH_MONITOR_TOKEN>` (new secret, requested via the secret tool). Constant-time compare via the existing `timingSafeEqual` helper in `_shared/commsDigestCronAuth.ts`. Missing secret → 503 `misconfigured`; bad/missing token → 401 with nothing else disclosed. User JWTs are never accepted.
- `config.toml`: add `[functions.system-health] verify_jwt = false` (token auth is in-code).
- Service role used only inside the function; single `rpc('get_system_health')` call; no writes.
- Adds `response_time_ms` and `checked_at`; rolls subsystem statuses into a top-level `status`.

## 3. Thresholds

- Database read fails → `critical` (503).
- Email worker (1-min cadence): success age < 5 min healthy; 5–10 min degraded; > 10 min critical. Based on cron run details, not last email sent. Zero volume is healthy.
- Email queue: oldest *due* queued job > 10 min degraded, > 30 min critical; `stuck_processing_count` > 0 with age > 15 min degraded, > 60 min critical (age-based proxy, conservative to avoid flagging legitimate retries); ≥ 10 failures in 15 min degraded, ≥ 25 critical.
- Paused (global or all streams) → `paused` status, HTTP 200, never critical.
- Hot Sheets: cron heartbeat thresholds same as email worker (it is a real recurring drainer). Outbox backlog: oldest pending event > 15 min degraded, > 60 min critical. No events pending = healthy.
- Inactive jobs (3, 4, 5, 7) are listed as `inactive` informational only, never failing.

## 4. HTTP behavior

200 healthy / degraded / paused; 503 only on a definite critical subsystem failure; 401 bad token; 503 `misconfigured` if the secret is unset. Target well under 1s (single RPC).

## 5. Out of scope

No changes to `process-email-queue`, `kick-email-queue`, Hot Sheet matching/delivery, cron schedules, retry rules, templates, auth, or preferences. No external monitor built into AAC. Only the new migration and the new `system-health` function are deployed.

## 6. Verification

Curl the deployed function with a valid token, a wrong token, and no token; confirm JSON shape, absence of PII, correct queue/worker/Hot Sheet numbers cross-checked against direct read-only SQL, healthy result during an empty-queue period, inactive crons reported as inactive, response time recorded, and no rows written (verified by before/after counts on `email_jobs` and `hot_sheet_listing_events`). No emails sent.

Report back: cron inventory with active flags, chosen signals/thresholds, migration name, files changed, function version, redacted sample response, verification results.

## Phase 2 (not in this plan)

Frontend error monitoring (Sentry-style) and external alerting via SMS/push on a channel independent of AAC's email queue.
