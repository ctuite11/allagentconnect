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

## 3. Proposed architecture — durable outbox + delivery claims

```text
listing status/field change
        |
   (trigger, SAME transaction, NOT exception-wrapped)
        v
  hot_sheet_listing_events          <- primary durability. correlation id.
        |                              duplicate trigger events are allowed here.
   (worker: cron every minute + best-effort pg_net kick)
        v
  matching (check_hot_sheet_matches)
        |
        v
  hot_sheet_delivery_claims         <- LOGICAL dedup boundary, DB-enforced unique
        |                              (listing, status, hot_sheet, audience, recipient)
        v
  email_jobs (stream=hot_sheet)     <- unchanged, same transaction as the claim
        |
        v
  hot_sheet_sent_listings           <- unchanged, final delivery evidence
```

Two separate concerns, deliberately decoupled:

- **Event stream** (`hot_sheet_listing_events`) is intentionally permissive. If a save produces three trigger events, three event rows exist. Losing an event is unacceptable; having extra events is harmless.
- **Delivery claim** (`hot_sheet_delivery_claims`) is intentionally strict. It is the single place where "has this logical notification already been committed to?" is answered, and it is answered by a unique index, not by application logic.

`hot_sheet_sent_listings` and `email_jobs.idempotency_key` remain, but they are now the *second and third* lines of defence, not the first.

## 4. Correction 1 — idempotency around the logical notification

**The problem with the previous draft.** Burnham produced `draft → coming_soon` at 01:23:30.16 and `new → coming_soon` at 01:23:30.87. A key containing `changed_at` treats those as two distinct logical events. Two workers could claim them concurrently, both run the matcher, both see no `hot_sheet_sent_listings` row yet, and both enqueue. That is a real race, not a theoretical one.

**Where uniqueness is enforced.** One table, one unique index, at the delivery grain:

```sql
CREATE TABLE public.hot_sheet_delivery_claims (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  status_at_send text NOT NULL,          -- the RESULTING status, not the transition
  hot_sheet_id  uuid NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  audience      text NOT NULL,           -- 'agent' | 'client' | 'subscriber'
  recipient_key text NOT NULL,           -- lower(email) or user id, normalised
  event_id      uuid NOT NULL REFERENCES public.hot_sheet_listing_events(id),
  state         text NOT NULL,           -- 'enqueued' | 'paused_held' | 'skipped' | 'failed'
  reason        text,
  email_job_id  uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX hot_sheet_delivery_claims_logical_key
  ON public.hot_sheet_delivery_claims
     (listing_id, status_at_send, hot_sheet_id, audience, recipient_key);
```

The key deliberately excludes `event_id` and every timestamp. `event_id` is recorded as *which* event won the claim, for tracing — it is not part of the identity.

**How concurrent duplicate events behave.** The worker never writes the claim or the job itself. It calls a single service-role-only RPC that performs the whole logical delivery in one Postgres transaction (section 4a). Inside that transaction:

```sql
INSERT INTO public.hot_sheet_delivery_claims (...)
VALUES (...)
ON CONFLICT (listing_id, status_at_send, hot_sheet_id, audience, recipient_key)
DO NOTHING
RETURNING id;
```

- Zero rows returned → another event already owns this notification. The RPC returns `duplicate`, records `skipped_duplicate` in the stage log against the losing `event_id`, and enqueues nothing.
- One row returned → this call owns the notification and, **in the same transaction**, either enqueues the job or holds it (section 4a).

Under concurrency, the second `INSERT` blocks on the unique index until the first transaction commits or rolls back, then either conflicts (first committed → correctly skipped) or succeeds (first rolled back → correctly retried). Postgres does the arbitration; no advisory locks, no read-then-write window.

`hot_sheet_sent_listings` continues to be written on delivery and continues to feed `check_hot_sheet_matches` exclusion — it now guards *across* status cycles, while the claim guards *within* one.

Event-level `dedupe_key` is retained only as an ingest guard against the exact same trigger firing twice for one row version (`listing_id, new_status, changed_at, trigger_op`). It is explicitly **not** the delivery dedup key.

## 4a. Correction — claim and email job are atomic *in Postgres*

The previous draft left `email_jobs` insertion to the Edge Function after the claim committed. That is a crash window: claim committed → isolate dies → no job → the unique claim permanently blocks any retry. Corrected: the Edge Function performs **no** claim or job writes. One RPC does the complete logical operation.

```sql
CREATE OR REPLACE FUNCTION public.enqueue_hot_sheet_delivery(
  p_event_id      uuid,
  p_listing_id    uuid,
  p_status        text,
  p_hot_sheet_id  uuid,
  p_audience      text,
  p_recipient_key text,
  p_payload       jsonb,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ... $$;
```

Executed as one transaction, service-role only (`REVOKE EXECUTE FROM anon, authenticated`), asserted via `assert_service_role()`:

1. `assert_service_role()`.
2. Insert the claim with `ON CONFLICT … DO NOTHING RETURNING id`. No row → return `{"result":"duplicate"}` and stop. Nothing else is written.
3. Re-read the pause state **inside** the transaction (`HOT_SHEET_EMAILS_PAUSED` / `EMAIL_SENDING_PAUSED` via the existing stream gate). If paused → set the claim to `paused_held` with a reason, insert **no** `email_jobs` row, return `{"result":"paused_held"}`.
4. Not paused → `INSERT INTO email_jobs (…) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`. If the job already existed (pre-outbox history), adopt its id rather than duplicating.
5. `UPDATE` the claim to `state = 'enqueued'`, `email_job_id = <id>`.
6. Commit. Return `{"result":"enqueued","claim_id":…,"email_job_id":…}`.

Invariants this guarantees, enforced by the transaction rather than by worker code:

- No committed `enqueued` claim without its `email_jobs` row — a `CHECK (state <> 'enqueued' OR email_job_id IS NOT NULL)` makes the invariant declarative.
- No `email_jobs` row from this path without a claim.
- A crash at any point rolls both back, and the event is simply retried; the second attempt either re-wins the claim (previous attempt rolled back) or sees `duplicate` (previous attempt committed, job exists).
- Pause is evaluated inside the same transaction, so a pause toggling mid-run cannot produce a half-state.

`record_hot_sheet_delivery_claim(...)` from the earlier draft is withdrawn and replaced by this function.

## 5. Correction 2 — primary outbox vs. optional observability

Two different reliability classes, never conflated:

**Primary outbox event — atomic, not exception-wrapped.**

```sql
INSERT INTO public.hot_sheet_listing_events (listing_id, trigger_op, old_status, new_status, dedupe_key, state)
VALUES (NEW.id, TG_OP, OLD.status, NEW.status, ..., 'pending')
ON CONFLICT (dedupe_key) DO NOTHING;
```

No `BEGIN … EXCEPTION WHEN OTHERS` around it. If this insert cannot happen, the listing status change **does not commit**. A qualifying status change and its delivery obligation succeed or fail together.

**Stage/audit logging — best-effort, non-fatal.** Everything written to `hot_sheet_event_stage_log` (and any HTTP kick) stays inside an exception block that swallows errors. Losing a breadcrumb must never abort a save; losing the obligation must always abort it.

The old `dispatch_hot_sheet_listing` pg_net call moves entirely into the best-effort class — a latency optimisation only. If it throws, times out, or the secret is missing, the listing still saves, the event still exists, and the cron worker picks it up within a minute.

**The rare failure case, honestly.** If the outbox insert fails, the agent's status change fails with an error and they retry. Why that is the right tradeoff:

- The insert touches one small append-only table with a single unique index and no FK to anything volatile beyond `listings`. Its realistic failure modes are disk-full, a hard outage, or a bug in the trigger — cases where the listing write is in trouble anyway.
- The alternative — commit the listing and lose the obligation — is exactly the Ashwood failure, institutionalised.
- Blast radius is scoped: only *qualifying status transitions* insert an event. Draft edits, photo reordering, and non-qualifying price edits never touch the outbox and can never be blocked by it.
- A failed save is loud and recoverable in seconds; a silent lost alert is invisible for days.

Mitigations that keep the failure surface tiny: no FKs to `hot_sheets` or `email_jobs` on the event table, no triggers on the event table, no network call in the atomic path, and only the one unique index.

## 5a. Correction — leases and stale-claim recovery

`claim_hot_sheet_events()` must never be able to strand an event in `claimed`.

Event table gains `claimed_at timestamptz`, `lease_expires_at timestamptz`, `claimed_by text` (worker/invocation id), alongside `attempts` and `next_attempt_at`.

```sql
UPDATE public.hot_sheet_listing_events e
   SET state = 'claimed',
       claimed_at = now(),
       claimed_by = p_worker_id,
       lease_expires_at = now() + interval '5 minutes',
       attempts = e.attempts + 1
 WHERE e.id IN (
   SELECT id FROM public.hot_sheet_listing_events
    WHERE (state = 'pending' AND coalesce(next_attempt_at, now()) <= now())
       OR (state = 'claimed' AND lease_expires_at < now())      -- stale reclaim
       OR (state = 'failed'  AND next_attempt_at <= now() AND attempts < 8)
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
 )
RETURNING e.*;
```

- **Lease duration: 5 minutes.** Comfortably above the Edge Function wall-clock ceiling, so a live worker can never have its lease expire underneath it; short enough that a crashed worker's event is retried on the next minute-cron pass after expiry.
- **Reclaimable when** `state = 'claimed' AND lease_expires_at < now()`. The reclaim is a plain `UPDATE` under `SKIP LOCKED`, so two workers cannot both reclaim the same row.
- **Attempts / backoff:** `attempts` increments on every claim, including reclaims. On failure the worker sets `state = 'failed'`, `last_error`, and `next_attempt_at = now() + least(interval '1 minute' * power(2, attempts), interval '1 hour')`. After 8 attempts the event stops being picked up and stays `failed` for admin review — visible, never silently dropped.
- **If the original worker resumes after its lease expired:** it has no authority, and it does not need any. All of its meaningful writes go through `enqueue_hot_sheet_delivery`, which is guarded by the logical unique index — so it either sees `duplicate` (the reclaiming worker already did the work) or wins claims the other worker had not reached. Its terminal `UPDATE` on the event is fenced with `WHERE claimed_by = p_worker_id AND lease_expires_at > now()`, so a zombie cannot overwrite the newer worker's state. Worst case: harmless duplicate matcher work, zero duplicate email.

## 6. Exact objects that would change

**New tables** (service-role only, RLS enabled, no `anon` / `authenticated` grants):
- `public.hot_sheet_listing_events` — `id`, `listing_id`, `trigger_op`, `old_status`, `new_status`, `state` (`pending` | `claimed` | `processed` | `paused_held` | `skipped` | `failed`), `attempts`, `next_attempt_at`, `claimed_at`, `claimed_by`, `lease_expires_at`, `last_error`, `dedupe_key` (unique, ingest guard only), `created_at`, `updated_at`.
- `public.hot_sheet_delivery_claims` — as specified in section 4, with the logical unique index and the `enqueued ⇒ email_job_id IS NOT NULL` check constraint.
- `public.hot_sheet_event_stage_log` — append-only: `event_id`, `stage`, `outcome`, `detail jsonb`, `created_at`. Best-effort writes only.

**Database functions**
- `notify_matching_buyers_on_new_listing` — atomic outbox INSERT (not wrapped); best-effort kick + stage log in a separate exception-wrapped block.
- `dispatch_hot_sheet_listing` — demoted to best-effort kick; every exit path attempts a stage-log row.
- `public.claim_hot_sheet_events(p_limit int, p_worker_id text)` — lease-based claim with stale reclaim, per section 5a.
- `public.enqueue_hot_sheet_delivery(...)` — the atomic claim + job RPC, per section 4a.
- `public.complete_hot_sheet_event(...)` / `public.fail_hot_sheet_event(...)` — lease-fenced terminal state writes.

**Edge Functions**
- `notify-matching-buyers` — outbox worker entry point; accepts `event_id`(s), idempotent, safe to call repeatedly. Writes no claims or jobs directly.
- `send-new-match-notification` — every current `continue` path routes through `enqueue_hot_sheet_delivery` or a stage-log reason instead of vanishing. **No change to matching criteria.**
- New `process-hot-sheet-events` — cron drainer (scheduled only at the final, separately approved step).

Unchanged: `check_hot_sheet_matches`, `email_jobs` schema, `hot_sheet_sent_listings`, every pause switch, every email template.

## 7. Deployment sequence (pause-gated)

**Step 0 — pause prerequisite, and it is a real gate.** Before Migration C touches the production trigger:

1. Confirm `HOT_SHEET_EMAILS_PAUSED` is enabled.
2. Prove **both** Hot Sheet sending paths honour it — the near-real-time path (`notify-matching-buyers` → `send-new-match-notification`) and the queue drain (`process-email-queue`) — by asserting the gate returns `paused` for each, not by assuming it.
3. Record the exact `email_jobs` count and re-assert it after every subsequent step.

If any of the three fails, the sequence stops. The earlier claim that steps 1–5 "cannot send under any circumstance" was wrong as written, because Migration C leaves the legacy path live; it is true **only** with Step 0 as a hard prerequisite, which it now is.

1. **Migration A** — three new tables, grants, RLS, policies, logical unique index, check constraint. Inert.
2. **Migration B** — `claim_hot_sheet_events`, `enqueue_hot_sheet_delivery`, `complete_/fail_hot_sheet_event`. Inert.
3. **Migration C** — trigger writes the atomic outbox event **in addition to** the existing legacy kick. No worker scheduled; events accumulate. Legacy behaviour otherwise unchanged, and neutered for sending by Step 0.
4. **Zero-email verification** (section 8) — entirely synthetic, under pause, rolled back.
5. **Deploy** worker changes to the two Edge Functions plus `process-hot-sheet-events`, still unscheduled, still paused.
6. **Migration D** — schedule the worker cron. Still paused: the drainer runs and produces `paused_held` claims only.
7. **Production canary** — separate approval. One real future listing; pause lifted only for that window.
8. **Migration E** — later, separate approval: remove the legacy silent paths once the outbox has proven itself.

Hot Sheet email sending stays paused continuously from Step 0 through Step 6. Each step is independently revertible.

## 8. Zero-email verification

`HOT_SHEET_EMAILS_PAUSED` stays set for the entire window. **No step requires the legacy path to deliver a real email** — the earlier "observe a real publish and confirm legacy still delivers" step is removed.

Verification runs against a synthetic fixture listing and hot sheet inside a rolled-back transaction, using the disposable-Postgres harness (`scripts/run-hot-sheet-db-tests.sh`) plus the Deno suite:

1. **Baseline** — record `SELECT count(*) FROM email_jobs`; assert unchanged after every step below.
2. **Durability** — qualifying status transition on the fixture listing → exactly one `hot_sheet_listing_events` row, state `pending`, correct correlation id.
3. **Atomicity of the obligation** — force the outbox insert to fail; assert the listing UPDATE itself fails and rolls back. Restore.
4. **Non-fatal logging** — force the stage-log write and the pg_net kick to throw; assert the listing save and the outbox event both still succeed.
5. **Matching** — run the worker; `check_hot_sheet_matches` returns the expected hot sheets and a claim row is persisted per matched recipient with an explicit state.
6. **Pause** — every claim lands in `paused_held`, reasons recorded, **zero** `email_jobs` rows created.
7. **Atomic RPC crash-safety** — call `enqueue_hot_sheet_delivery` with the pause lifted *in the disposable cluster only*, aborting the transaction mid-way; assert neither the claim nor the job survives, and that a retry succeeds cleanly. Then assert no `enqueued` claim anywhere lacks an `email_job_id`.
8. **Concurrency / duplicates** — two outbox events for the same `(listing, resulting status)` (the Burnham double-trigger), processed from two concurrent sessions: exactly one claim per `(listing, status, hot_sheet, audience, recipient)`, loser recorded `skipped_duplicate`, zero `email_jobs`.
9. **Lease recovery** — claim an event, simulate worker death, advance past `lease_expires_at`; assert a second worker reclaims it, `attempts` increments, no duplicate claims are produced, and a zombie resume of the first worker is rejected by the lease fence.
10. **Failure/retry durability** — inject a matcher error; event lands in `failed` with `attempts`, `last_error`, future `next_attempt_at`; a later pass re-claims without duplicating claims; after 8 attempts it stops and stays visible.
11. **Isolation** — no `hot_sheet_sent_listings` rows and no `email_jobs` rows written by any step against production; roll back and destroy the disposable cluster.
12. **Reconciliation query** — ship a standing check: every `listing_status_history` row with a dispatchable `new_status` since cutover must have at least one outbox event. This is the regression detector that would have caught Ashwood the same day.

Only after all twelve pass would a production canary on a real future listing be proposed for separate approval.

No resend of the Ashwood alert, no backfill, no replay of any historical event is part of this plan.
