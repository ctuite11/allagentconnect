# Hot Sheet delivery hardening — durable outbox architecture (proposal only)

Nothing is built, migrated, deployed, resent, retried, or backfilled by this document. Read-only investigation is complete; everything below is a design awaiting approval.

## 1. Burnham vs. Ashwood — final read-only findings

**What is recoverable**
- Edge Function logs: `notify-matching-buyers` and `send-new-match-notification` return no logs at all — retention does not reach Aug 14.
- Edge invocation analytics (`function_edge_logs`): total retained rows = 11, spanning roughly the last hour. Aug 14 18:30–18:50 UTC returns zero rows.
- `net._http_response`: oldest retained row is Aug 15 20:00 UTC (~6h window). The Aug 14 dispatch response is gone.
- `net.http_request_queue`: currently 0 rows — transport is healthy now, and nothing from Aug 14 is stuck.

**What the durable data does show**
- `44 Ashwood Avenue` (`e5f05daf…`): created Aug 7 17:31 UTC, exactly **one** status event — `draft → coming_soon` at Aug 14 18:37:50 UTC. Zero `hot_sheet_sent_listings` rows, zero `email_jobs`.
- `23 Burnham Street` (`5f46fa9c…`): **two** status events one second apart — `draft → coming_soon` at 01:23:30.16 and `new → coming_soon` at 01:23:30.87 — followed by a send row at 01:23:31.67.
- Every other successful publish since Aug 6 shows the same double-event pattern (Oakwood, Court St, Pacella, Washington Ave, Albemarle each recorded 2–3 status rows). **Ashwood is the only listing since Aug 6 that fired exactly one dispatch attempt, and it is the only miss.**
- Since the Aug 6 reopening, misses = 1 of 8 publish events. The Aug 5 zero-send rows (Hanover, Allen, Abington) predate the reopening and are expected.
- Hot sheet `044322c7` has been `is_active = true`, `notification_schedule = immediately`, last modified Aug 6 02:05 UTC — it was fully live in both windows.
- No migration was applied between Aug 13 00:58 and Aug 15 02:06 UTC, so no schema, trigger, dispatcher, or Vault change sits between the two timestamps.
- Matcher dry-run today: `check_hot_sheet_matches('044322c7…')` returns 25 candidates and **includes Ashwood**. Matching is not the fault.

**Conclusion:** the drop is upstream of the matcher, in `trigger → pg_net → Edge Function`, and it is unprovable because that path writes no durable record. The redundant second status update that most publishes happen to produce has been acting as an accidental retry; Ashwood had a single attempt and lost it. Pause state, deployment history, and Vault state cannot be differentiated between the two timestamps from retained data — which is itself the finding.

## 2. Current failure points

Each of these can swallow a qualifying event with no durable evidence:

1. `notify_matching_buyers_on_new_listing` — `EXCEPTION WHEN OTHERS` → `RAISE WARNING`, not persisted.
2. `dispatch_hot_sheet_listing` — four silent exits (`null id`, `listing not found`, `missing/empty Vault secret`, catch-all) all `RAISE WARNING` only.
3. `net.http_post` — fire-and-forget: the trigger never sees the status code; responses age out in ~6h.
4. `notify-matching-buyers` — a 401 (bad/rotated service key), 5xx, cold-start timeout, or isolate shutdown is invisible to the database.
5. Pause gate — returns `200 {paused: true, hot_sheet_fanout: "skipped"}` and the event is simply gone; nothing is queued for later.
6. `send-new-match-notification` — `if (matchError) continue;` and several `continue` paths drop a hot sheet with no record.
7. Observability — the only success evidence is `hot_sheet_sent_listings`; absence of a row is indistinguishable from "never attempted", "attempted and failed", and "correctly filtered".

## 3. Proposed architecture — durable outbox

```text
listing status/field change
        |
   (trigger, same transaction)
        v
  hot_sheet_listing_events        <- durable, one row per qualifying event, correlation_id
        |
   (worker: cron every minute + optional pg_net kick)
        v
  matching (check_hot_sheet_matches)
        |
        v
  hot_sheet_event_targets         <- one row per (event, hot_sheet), explicit state
        |
        v
  email_jobs (stream=hot_sheet)   <- unchanged, still the delivery record
        |
        v
  hot_sheet_sent_listings         <- unchanged, still the final dedup evidence
```

Principle: the event is durable **before** pg_net or any Edge Function is involved. pg_net becomes a latency optimisation, never the system of record. If every HTTP call fails, the cron worker still drains the outbox.

## 4. Exact objects that would change

**New tables (service-role only, RLS enabled, no `anon`/`authenticated` grants)**
- `public.hot_sheet_listing_events` — `id` (correlation id), `listing_id`, `trigger_op`, `old_status`, `new_status`, `changed_fields text[]`, `state` (`pending` | `matching` | `processed` | `paused_held` | `skipped` | `failed`), `attempts`, `next_attempt_at`, `last_error`, `dedupe_key` (unique: `listing_id::new_status::changed_at`), `created_at`, `updated_at`.
- `public.hot_sheet_event_targets` — `event_id`, `hot_sheet_id`, `audience` (`agent`/`client`/`subscriber`), `recipient_key`, `state` (`matched` | `enqueued` | `skipped_not_eligible` | `skipped_already_sent` | `paused_held` | `failed`), `email_job_id`, `reason`, `created_at`. Unique on `(event_id, hot_sheet_id, audience, recipient_key)`.
- `public.hot_sheet_event_stage_log` — append-only stage history: `event_id`, `stage`, `outcome`, `detail jsonb`, `created_at`.

**Changed database functions**
- `notify_matching_buyers_on_new_listing` — replaces the `PERFORM dispatch_hot_sheet_listing(...)` call with an INSERT into `hot_sheet_listing_events` (same transaction as the listing save, so it commits atomically with it). The whole body stays wrapped so a logging failure can never abort a listing save.
- `dispatch_hot_sheet_listing` — demoted to a "kick" that is best-effort only; every exit path first writes a `hot_sheet_event_stage_log` row.
- New `public.claim_hot_sheet_events(p_limit int)` — `SELECT … FOR UPDATE SKIP LOCKED`, marks claimed rows `matching`, returns them. Prevents double-processing across concurrent workers.

**Changed Edge Functions**
- `notify-matching-buyers` — becomes the outbox worker entry point: accepts `event_id`(s), claims via the RPC, records stages, and is safe to call repeatedly.
- `send-new-match-notification` — every `continue` path writes a `hot_sheet_event_targets` row with an explicit reason instead of silently skipping. No change to matching criteria.
- New cron: `process-hot-sheet-events` every minute, draining `pending` and due `failed`/`paused_held` events with capped exponential backoff.

Unchanged: `check_hot_sheet_matches`, `email_jobs`, `hot_sheet_sent_listings`, all pause switches, all email templates.

## 5. Migration / deployment sequence

1. Migration A — create the three tables with grants, RLS, and policies (service-role only). No behaviour change.
2. Migration B — add `claim_hot_sheet_events` plus stage-log helpers.
3. Migration C — trigger writes to the outbox **in addition to** the existing pg_net kick (shadow mode; both paths run, worker cron not yet scheduled).
4. Observe shadow data on the next real publish: confirm one event row per qualifying change and that the legacy path still delivers.
5. Deploy worker changes to the two Edge Functions plus `process-hot-sheet-events`, still with the Hot Sheet pause switch set for the verification window.
6. Migration D — schedule the worker cron; the pg_net kick stays only as a latency shortcut.
7. Migration E (later, separate approval) — remove the legacy silent paths once the outbox has proven itself across several real publishes.

Each step is independently revertible; steps 1–3 cannot send email under any circumstance.

## 6. Dedup / idempotency

- Event level: unique `dedupe_key` per `(listing_id, new_status, changed_at)` — the duplicate `draft→X` / `new→X` pairs collapse into distinct rows but produce identical downstream keys, so no duplicate email.
- Target level: unique `(event_id, hot_sheet_id, audience, recipient_key)`.
- Job level: existing `email_jobs.idempotency_key` (`agentIdempotencyKey` / `clientListingIdempotencyKey` / `subscriberListingIdempotencyKey`) is untouched — a unique violation still counts as success.
- Final evidence: `hot_sheet_sent_listings` with its `(hot_sheet_id, listing_id, status_at_send)` semantics stays the authoritative "already delivered at this status" guard, and `check_hot_sheet_matches` keeps excluding on it.
- Worker claims use `FOR UPDATE SKIP LOCKED` plus an attempt counter, so retries are safe and bounded.

## 7. Pause behaviour without losing events

- Today: paused → `200 skipped`, event vanishes.
- Proposed: paused → event moves to `paused_held` with a stage-log entry, matching still runs (targets recorded), but **no `email_jobs` row is created**.
- On unpause, held events are **not** auto-released. Releasing is an explicit admin action against a bounded, reviewable list, honouring the standing rule that queue re-enqueues require per-action approval. Events older than a configurable horizon can be closed as `skipped` with a reason rather than sent.
- All existing pause switches (`EMAIL_SENDING_PAUSED`, `HOT_SHEET_EMAILS_PAUSED`, `DEVELOPMENT_EMAILS_PAUSED`) keep their current meaning and precedence.

## 8. Safe verification with zero emails

1. Keep `HOT_SHEET_EMAILS_PAUSED` set for the entire verification window; record `email_jobs` count before and after and assert it is unchanged.
2. Shadow mode (step 3) on a real publish: assert exactly one outbox row per qualifying change, and that the legacy path's `hot_sheet_sent_listings` behaviour is identical to today.
3. Worker run under pause: assert every event reaches `paused_held`, targets are recorded with reasons, and zero `email_jobs` rows are inserted.
4. Failure injection in a transaction that is rolled back: force a Vault-secret-missing and an HTTP-failure path, assert a durable `failed` event with `next_attempt_at`, then roll back.
5. Existing Deno test suite extended with unit tests for claim/idempotency/pause-hold; no network, no provider.
6. Reconciliation query: every `listing_status_history` row with a dispatchable `new_status` since cutover must have exactly one outbox event — a permanent regression check that would have caught Ashwood the same day.

No resend of the Ashwood alert, no backfill, no replay of any historical event is part of this plan.
