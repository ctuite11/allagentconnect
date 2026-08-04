# Communications Center — final reopening checks

Read-only inventory is already done. Nothing has been changed, no email sent, all pause flags untouched.

## What the live data shows now

Queued Communications backlog — exactly 194 rows, all `stream = communications`, all `status = queued`:

```text
template                    count  recipients  idempotency prefix       created (UTC)
client-need-broadcast        130     67        client-need-broadcast:   2026-08-04 13:45 - 16:36
client-need-notification      64     64        client-need:             2026-08-04 02:05
```

No queued/processing jobs exist in any other stream. The 130 broadcast rows map to the two Aug 4 `comms_broadcasts` rows:
- `bdf2e4b4…` sales_intel "Coming soon to Reading" (recipient_count 70, 13:45)
- `dc4922ca…` buyer_need "BUYER NEED: Mutli Fam Southie $1m-$2.5m" (recipient_count 73, 16:36)

Current flags: `EMAIL_SENDING_PAUSED=false`, `COMMS_EMAILS_PAUSED=true`, `HOT_SHEET_EMAILS_PAUSED=true`. The global pause is already off — the only thing holding these 194 jobs is the Communications stream flag. `allowedStreams()` right now permits `transactional` and `system`.

Digests: 26 pending items (18 daily, 8 weekly), and `comms_digest_sends` is completely empty — no digest has ever dispatched.

## Blocker on step 1 (needs your decision)

`email_jobs` has two overlapping status CHECK constraints:

```text
chk_email_job_status     -> queued, processing, sent, failed, cancelled
email_jobs_status_check  -> queued, processing, sent, failed          <-- blocks 'cancelled'
```

So a terminal `cancelled` state is intended but currently unreachable: the older, redundant constraint rejects it. I will not mark the jobs `failed` (that misrepresents them and keeps them in retry semantics) and I will not invent a new state.

Proposed minimal fix, as its own migration: drop only the stale duplicate `email_jobs_status_check`, leaving `chk_email_job_status` as the single source of truth. No column, index, or data change.

## Step 1B — Retire exactly the inventoried 194 jobs

The target set is now a frozen, explicit ID list captured by the completed inventory — not a date filter. 194 unique IDs, MD5 of the sorted list: `6f1fa8f8a598a6bad6d1ca3385d1651e`. The list is written into the migration as a literal array.

One transaction, aborting and rolling back if any precondition fails:

- the literal ID array contains exactly 194 unique IDs
- every ID still has `status = 'queued'`, `stream = 'communications'`, and an Aug 4 containment `created_at`
- no target ID has been sent, claimed, retried, or otherwise mutated (`attempts = 0`)
- no queued/processing Communications job exists outside the target set
- then: `UPDATE ... SET status = 'cancelled', last_error = 'retired: old audience logic (2026-08-04 containment)'` for those IDs only
- then: exactly one `email_events` row per job with `event = 'retired'` and detail `{source: 'containment_cleanup', previous_status: 'queued', reason: ...}`
- row counts of both statements must equal 194 or the transaction raises and rolls back

Note from the inventory: one `system`-stream verification email was queued and sent normally at 19:05 UTC during this audit. That is expected — the system/transactional streams are open — and it is outside the target set.

No sends, retries, re-enqueues, recipient edits. No touching sent/historical, Hot Sheet, transactional, or system jobs. No digest-item or preference changes.

Verification returned afterward: targeted 194 / still claimable 0 / sent 0 / provider calls 0 / other jobs changed 0, plus an md5 hash of the sorted retired ID list and the exact SQL used.

## Step 2 — Dry-run the most recent Buyer Need

Target is identified without asking you: `comms_broadcasts.dc4922ca-49b6-4aec-b60c-16a23ad476b8`, sender `12094347…`, subject "BUYER NEED: Mutli Fam Southie $1m-$2.5m", criteria `{state: MA, cities: [Boston], neighborhoods: [South Boston], propertyTypes: [multi_family], minPrice: 1000000, maxPrice: 2000000}`.

`send-client-need-notification` already supports `dry_run: true` with a zero-write short-circuit that returns before any broadcast insert, email_jobs insert, digest insert, or dedup write. I will replay that exact payload with `dry_run: true` and report the full funnel: activated-agent base, self-excluded, missing opt-in, master switches off, buyer-need category off, targeting mismatch, globally suppressed, no usable email, final recipient count — plus the recipient list with name, email, user ID, cadence, and match reason.

## Step 3 — Digest dispatch health (read-only)

Report pending daily/weekly items, the empty `comms_digest_sends` history, the last `process-comms-digests` invocation from its function logs, whether its authorization path now works (the previously missing `service_role_key` GUC used by `invoke_process_comms_digests`), and whether a scheduled item could actually reach `email_jobs` at the 18:00 ET window. No forced digest, no test email.

## Step 4 — Pause behavior

Report the three flag values above, plus what `allowedStreams()` would permit with the global flag removed — and note explicitly that "communications only" is not a thing the global flag can express: clearing `EMAIL_SENDING_PAUSED` opens transactional and system too, since only Communications and Hot Sheets have their own stream flags. Since the global flag is already `false`, reopening Communications is a single change to `COMMS_EMAILS_PAUSED`.

## Final report

Retirement result, dry-run audience and recipient list, digest health, remaining queued Communications jobs, current pause values, and the exact proposed flag change to reopen. No flag will be changed until you approve those numbers separately.

## Technical notes

- New migration: drop constraint `public.email_jobs_status_check` only.
- Retirement runs as a guarded `DO` block that raises and rolls back on any count mismatch.
- Dry-run is invoked against the deployed function; no code deploy in this step.
