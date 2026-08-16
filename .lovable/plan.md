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

**How concurrent duplicate events behave.** The worker, for each matched recipient, opens a transaction and does:

```sql
INSERT INTO public.hot_sheet_delivery_claims (...)
VALUES (...)
ON CONFLICT (listing_id, status_at_send, hot_sheet_id, audience, recipient_key)
DO NOTHING
RETURNING id;
```

- Zero rows returned → another event already owns this notification. The worker records `skipped_duplicate` in the stage log, attributes it to the losing `event_id`, and enqueues nothing.
- One row returned → this worker owns the notification. **In the same transaction** it inserts the `email_jobs` row (or, under pause, sets the claim to `paused_held` and inserts nothing) and commits. Claim and job are therefore atomic: no claim without a job, no job without a claim.

Under concurrency, the second `INSERT` blocks on the unique index until the first transaction commits or rolls back, then either conflicts (first committed → correctly skipped) or succeeds (first rolled back → correctly retried). Postgres does the arbitration; no advisory locks, no read-then-write window.

`hot_sheet_sent_listings` continues to be written on delivery and continues to feed `check_hot_sheet_matches` exclusion — it now guards *across* status cycles, while the claim guards *within* one.

Event-level `dedupe_key` is retained only as an ingest guard against the exact same trigger firing twice for one row version (`listing_id, new_status, changed_at, trigger_op`). It is explicitly **not** the delivery dedup key.

## 5. Correction 2 — primary outbox vs. optional observability

Two different reliability classes, never conflated:

**Primary outbox event — atomic, not exception-wrapped.**

```sql
INSERT INTO public.hot_sheet_listing_events (listing_id, trigger_op, old_status, new_status, dedupe_key, state)
VALUES (NEW.id, TG_OP, OLD.status, NEW.status, ..., 'pending')
ON CONFLICT (dedupe_key) DO NOTHING;
```

No `BEGIN … EXCEPTION WHEN OTHERS` around it. If this insert cannot happen, the listing status change **does not commit**. That is the whole point: a qualifying status change and its delivery obligation succeed or fail together.

**Stage/audit logging — best-effort, non-fatal.** Everything written to `hot_sheet_event_stage_log` (and any HTTP kick) stays inside an exception block that swallows errors. Losing a breadcrumb must never abort a save; losing the obligation must always abort it.

The old `dispatch_hot_sheet_listing` pg_net call moves entirely into the best-effort class. It becomes a latency optimisation only. If it throws, times out, or the secret is missing, the listing still saves, the event still exists, and the cron worker picks it up within a minute.

**The rare failure case, honestly.** If the outbox insert fails, the agent's status change fails with an error and they retry. Why that is the right tradeoff:

- The insert touches one small append-only table with a single unique index and no FK to anything volatile beyond `listings`. Its realistic failure modes are disk-full, a hard outage, or a bug in the trigger — all cases where the listing write is in trouble anyway.
- The alternative — commit the listing and lose the obligation — is exactly the Ashwood failure, but institutionalised.
- Blast radius is scoped: only *qualifying status transitions* insert an event. Draft edits, photo reordering, and price edits that do not qualify never touch the outbox and can never be blocked by it.
- A failed save is loud and recoverable in seconds. A silent lost alert is invisible for days.

Mitigations that keep the failure surface tiny: no FKs to `hot_sheets` or `email_jobs` on the event table, no triggers on the event table, no network call in the atomic path, and only the one unique index.

## 6. Exact objects that would change

**New tables** (service-role only, RLS enabled, no `anon` / `authenticated` grants):
- `public.hot_sheet_listing_events` — `id`, `listing_id`, `trigger_op`, `old_status`, `new_status`, `state` (`pending` | `claimed` | `processed` | `paused_held` | `skipped` | `failed`), `attempts`, `next_attempt_at`, `last_error`, `dedupe_key` (unique, ingest guard only), `created_at`, `updated_at`.
- `public.hot_sheet_delivery_claims` — as specified in section 4, with the logical unique index.
- `public.hot_sheet_event_stage_log` — append-only: `event_id`, `stage`, `outcome`, `detail jsonb`, `created_at`. Best-effort writes only.

**Database functions**
- `notify_matching_buyers_on_new_listing` — atomic outbox INSERT (not wrapped); best-effort kick + stage log in a separate exception-wrapped block.
- `dispatch_hot_sheet_listing` — demoted to best-effort kick; every exit path attempts a stage-log row.
- New `public.claim_hot_sheet_events(p_limit int)` — `FOR UPDATE SKIP LOCKED`, marks rows `claimed`, returns them.
- New `public.record_hot_sheet_delivery_claim(...)` — encapsulates the `ON CONFLICT DO NOTHING … RETURNING` so the uniqueness contract lives in one place.

**Edge Functions**
- `notify-matching-buyers` — outbox worker entry point; accepts `event_id`(s), idempotent, safe to call repeatedly.
- `send-new-match-notification` — every current `continue` path writes a claim row or a stage-log reason instead of vanishing. **No change to matching criteria.**
- New `process-hot-sheet-events` — cron drainer (scheduled only at the final, separately approved step).

Unchanged: `check_hot_sheet_matches`, `email_jobs` schema, `hot_sheet_sent_listings`, every pause switch, every email template.

## 7. Migration / deployment sequence

1. **Migration A** — three new tables, grants, RLS, policies, and the logical unique index. Inert.
2. **Migration B** — `claim_hot_sheet_events` and `record_hot_sheet_delivery_claim`. Inert.
3. **Migration C** — trigger writes the atomic outbox event **in addition to** the existing legacy kick. No worker is scheduled; events simply accumulate. Legacy delivery behaviour is byte-for-byte unchanged.
4. **Zero-email verification** (section 8) — entirely synthetic, under pause, rolled back.
5. **Deploy** worker changes to the two Edge Functions plus `process-hot-sheet-events`, still unscheduled and still under `HOT_SHEET_EMAILS_PAUSED`.
6. **Migration D** — schedule the worker cron.
7. **Production canary** — separate approval, one real future listing, pause lifted only for that window.
8. **Migration E** — later, separate approval: remove the legacy silent paths once the outbox has proven itself.

Steps 1–5 cannot send an email under any circumstance. Each step is independently revertible.

## 8. Correction 3 — verification sequence is truly zero-email

`HOT_SHEET_EMAILS_PAUSED` stays set for the entire window. **No step requires the legacy path to deliver a real email.** The previous draft's "observe a real publish and confirm legacy still delivers" step is removed.

Verification runs against a synthetic fixture listing and a synthetic hot sheet, inside a transaction that is rolled back, using the existing disposable-Postgres harness (`scripts/run-hot-sheet-db-tests.sh`) plus the Deno suite:

1. **Baseline** — record `SELECT count(*) FROM email_jobs`; assert unchanged at the end of every subsequent step.
2. **Durability** — perform a qualifying status transition on the fixture listing; assert exactly one `hot_sheet_listing_events` row, state `pending`, with the correct correlation id.
3. **Atomicity** — force the outbox insert to fail (temporarily invalid dedupe key); assert the listing UPDATE itself fails and rolls back, proving the obligation is atomic. Restore.
4. **Non-fatal logging** — force the stage-log write and the pg_net kick to throw; assert the listing save and the outbox event both still succeed.
5. **Matching** — run the worker; assert `check_hot_sheet_matches` returns the expected hot sheets and that a `hot_sheet_delivery_claims` row is persisted per matched recipient with an explicit state.
6. **Pause** — assert every claim lands in `paused_held`, reasons are recorded, and **zero** `email_jobs` rows are created.
7. **Concurrency / duplicates** — insert two outbox events for the same `(listing, resulting status)` mimicking the Burnham double-trigger, and process them from two concurrent sessions. Assert exactly one claim row per `(listing, status, hot_sheet, audience, recipient)`, the loser recorded as `skipped_duplicate`, and zero `email_jobs`.
8. **Failure/retry durability** — inject a matcher error; assert the event lands in `failed` with `attempts`, `last_error`, and a future `next_attempt_at`, and that a subsequent worker pass re-claims it without duplicating claims.
9. **Isolation** — assert no `hot_sheet_sent_listings` rows and no `email_jobs` rows were written by any step; roll back the transaction and drop the disposable cluster.
10. **Reconciliation query** — ship a standing check: every `listing_status_history` row with a dispatchable `new_status` since cutover must have at least one outbox event. This is the regression detector that would have caught Ashwood the same day.

Only after all ten pass would a production canary on a real future listing be proposed for separate approval.

No resend of the Ashwood alert, no backfill, no replay of any historical event is part of this plan.
