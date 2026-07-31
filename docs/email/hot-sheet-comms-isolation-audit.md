# Hot Sheet ↔ Communications Center Isolation Audit

**Status:** Draft for review — do **not** deploy, merge PR #33, unpause sending, or modify `email_jobs`.  
**Branch:** `cursor/fix-hot-sheet-property-notification-9df4`  
**Date:** 2026-07-30  

Keep:

```text
EMAIL_SENDING_PAUSED=true
```

Intended safe posture **after** approved deployment (not yet):

```text
EMAIL_SENDING_PAUSED=false
HOT_SHEET_EMAILS_PAUSED=true
COMMS_EMAILS_PAUSED=true
```

---

## 1. Hot Sheet path (current / target)

```text
listings INSERT/UPDATE
  → DB trigger notify_matching_buyers_on_new_listing
  → edge notify-matching-buyers
      → (pause gate: HOT_SHEET / global)
      → invoke send-new-match-notification
          → active Hot Sheets where notification_schedule = 'immediately'
          → check_hot_sheet_matches (real criteria)
          → agent / accepted client / subscriber enqueue
          → stream = hot_sheet
          → email_jobs
```

Manual / invite paths:

```text
UI / accept-client-hot-sheet-invite
  → process-hot-sheet
      → stream = hot_sheet (when emailing)

send-hot-sheet-invite / comment SQL triggers
  → stream = hot_sheet
```

Permanently quarantined (never claimable / never sendable):

```text
notify-agents-new-listing → { disabled: true }
payload.template = agent-new-listing-alert
OR idempotency_key LIKE agent-new-listing:%
```

These jobs are **not** classified as `hot_sheet`. Stream is cleared to NULL on migration; claim + `assertJobSendable` both refuse them regardless of any manually set stream.

---

## 2. Communications Center path (current / target)

```text
UI SendMessageDialog / SendEmailDialog
  → send-client-need-notification
      → verifiedAgentAudience + communicationPreferencesMatcher
      → stream = communications
      → email_jobs and/or comms_digest_items

client_needs INSERT (real Comms / non-Hot-Sheet rows)
  → notify_agents_of_client_need (DB)
  → notify-agents-client-need
      → skips historical Hot-Sheet-synced descriptions (defense in depth)
      → stream = communications

cron process-comms-digests
  → stream = communications

AgentMatch UI
  → send-seller-alert
      → stream = communications
```

---

## 3. Cross-calls discovered

| From | To | Status after this change |
|------|----|--------------------------|
| `notify-matching-buyers` → `send-new-match-notification` | Hot Sheet → Hot Sheet | **Safe** (canonical) |
| `notify-matching-buyers` → legacy `client_needs` emails | Listing → orphan emails | **Removed** |
| `notify-matching-buyers` → `notify-agents-new-listing` | Broad fan-out | **Disabled stub** |
| `hot_sheets` sync → `client_needs` | Hot Sheet → Comms bridge | **Dropped** (triggers/functions removed; historical rows kept) |
| `send-seller-alert` reads `hot_sheets` | Comms reads HS for provenance | **Read-only attribution** |
| Comms → `send-new-match-notification` | — | **None found** |
| Hot Sheet matcher → Comms prefs / verified audience | — | **None found** |

---

## 4. Hot Sheet → `client_needs` dependency search (read-only)

**Canonical Hot Sheet matcher does not use generated `client_needs` rows.** Matching goes through `hot_sheets` + `check_hot_sheet_matches`.

Consumers of `client_needs` (all treat rows as Comms / intel UI data; none require the sync bridge for Hot Sheet delivery):

| Consumer | Notes |
|----------|-------|
| `SubmitClientNeed` / Comms UI | Creates real Comms needs |
| `ClientNeedsDashboard`, ListingIntel*, ContactMatchesDialog, network activity | Read all `client_needs` (historical HS-synced orphans may still appear) |
| `notify-agents-client-need`, `send-client-need-notification` | Comms producers; skip `Auto-generated from hot sheet:%` |
| `admin-notification-backfill`, dry-run-comms | Comms tooling |

**Bridge dropped in migration `20260730200000`:**

```text
DROP TRIGGER sync_hot_sheet_to_client_needs_trigger
DROP TRIGGER delete_hot_sheet_client_needs_trigger
DROP FUNCTION sync_hot_sheet_to_client_needs()
DROP FUNCTION delete_hot_sheet_client_needs()
```

Existing generated rows are **not** deleted. Read-only cleanup decision query (production; do not mutate):

```sql
-- Count
SELECT count(*) AS generated_hot_sheet_client_needs
FROM public.client_needs
WHERE description LIKE 'Auto-generated from hot sheet:%';

-- Sample
SELECT id, agent_id, property_type, state, city, max_price, created_at,
       left(description, 120) AS description_preview
FROM public.client_needs
WHERE description LIKE 'Auto-generated from hot sheet:%'
ORDER BY created_at DESC
LIMIT 25;
```

After migration: creating/editing a Hot Sheet must not insert/update `client_needs`; deleting a Hot Sheet must not depend on deleting `client_needs`. Description guards remain as defense in depth for historical rows.

---

## 5. Shared tables / functions

| Resource | Sharing | Safe? |
|----------|---------|-------|
| `email_jobs` | Transport for all streams | **Safe** with required+immutable `stream` + channel-aware claim |
| `email_jobs_claim` | Worker | Excludes paused streams + retired broad-listing markers |
| `notification_preferences` | Comms only | **Safe** |
| `client_needs` | Comms + historical orphans | Bridge dropped; notify still skips HS marker |
| `hot_sheets` / `hot_sheet_*` | Hot Sheet owned | **Safe** |
| `check_hot_sheet_matches` | Hot Sheet only | **Safe** |

---

## 6. Stream immutability + fail-closed classification

1. **INSERT trigger** rejects null/invalid `stream` on new rows (legacy NULL rows may remain until classified/canceled).
2. **UPDATE OF stream trigger** rejects any stream change after insert.
3. Explicit allowlists: `HOT_SHEET_TEMPLATES`, `COMMS_TEMPLATES`, `TRANSACTIONAL_TEMPLATES`, `SYSTEM_TEMPLATES`.
4. Unknown template → `null` → `assertJobSendable` blocks (even if column says `transactional`).
5. Stream/template mismatch → blocked with both values in the error.
6. All audited TS + SQL producers set explicit `stream` (see migration `20260730210000_email_jobs_stream_sql_producers.sql` for comment / message / missing-opportunity SQL paths).

DB verification script (non-prod): `supabase/tests/email_jobs_stream_immutability.sql`.

---

## 7. Pause controls

| Env | Default behavior |
|-----|------------------|
| `EMAIL_SENDING_PAUSED` | **Fail closed:** unset or not `"false"` ⇒ paused |
| `HOT_SHEET_EMAILS_PAUSED` | Paused only when `"true"` |
| `COMMS_EMAILS_PAUSED` | Paused only when `"true"` |

Checked at enqueue, claim, and immediately before send. Pause-race requeue **restores** the claim attempt increment so races cannot exhaust `max_attempts`.

---

## 8. Dry-run commands (read-only)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/dry-run-hot-sheet-listing" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"listing_id":"<LISTING_UUID>"}'

curl -X POST "$SUPABASE_URL/functions/v1/dry-run-comms-broadcast" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"broadcast_id":"<BROADCAST_UUID>"}'
```

---

## 9. Test results

```bash
deno test --allow-env \
  supabase/functions/_shared/emailStreams.test.ts \
  supabase/functions/_shared/notificationIsolation.test.ts \
  supabase/functions/_shared/hotSheetAgentDelivery.test.ts
```

### Required verification matrix

```text
Retired agent-new-listing jobs can never be claimed or sent: PASS
Unknown templates fail closed: PASS
Stream/template mismatches fail closed: PASS
email_jobs.stream is immutable after insertion: PASS (DB triggers + supabase/tests/email_jobs_stream_immutability.sql)
All new queue insertions require an explicit stream: PASS (INSERT trigger + producer audit)
Hot Sheets no longer write to client_needs: PASS (triggers/functions dropped)
Hot Sheet pause remains independent from Communications pause: PASS
Communications pause remains independent from Hot Sheet pause: PASS
Pause races do not consume attempts: PASS
PR rebased and mergeable: PASS (replayed onto current main; draft kept)
```

---

## 10. Remaining risks

1. **Migration not applied** — do not deploy until approved.
2. **Daily/weekly Hot Sheets** still have no digest worker (pre-existing).
3. **Historical Hot-Sheet-synced `client_needs` orphans** remain until a separate cleanup decision.
4. **Retired `agent-new-listing-*` backlog** left unclaimable; do not cancel/snapshot until separately approved.
5. **Global pause fail-closed** — production must set `EMAIL_SENDING_PAUSED=false` explicitly to resume any sending.
6. **Unsubscribe / prefs / removals** for Communications still need verification before COMMS unpause.

### Hot Sheet safety fixes (reconciled in this PR)

| Fix | Status |
|-----|--------|
| Add a Friend / subscriber add → `process-hot-sheet` `{ baselineOnly: true }` (prevents backlog fan-out) | **Done** |
| `baselineOnly` upsert conflict target matches unique index `(hot_sheet_id,listing_id,status_at_send)` | **Done** |
| Legacy `send-hot-sheet-alert` edge function retired to disabled stub (no `email_jobs` insert) | **Done** |
| Template `hot-sheet-alert` kept for intentional `process-hot-sheet` manual/batch path | **Kept** |

---

## 11. Boundary statements

```text
Hot Sheets can be paused while Communications Center remains active: PASS
Communications Center can be paused while Hot Sheets remain active: PASS
A listing event cannot create a Communications Center broadcast: PASS
A Communications Center broadcast cannot create a Hot Sheet notification: PASS
Creating/editing a Hot Sheet does not write client_needs: PASS (after migration)
Retired broad-listing jobs cannot become claimable when Hot Sheets unpause: PASS
```

---

## 12. Legacy backlog inspection (read-only; do not modify)

```sql
SELECT
  status,
  stream,
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
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3, 4;
```

Do not cancel `processing` unless the queue worker is paused. Do not modify production `email_jobs` in this work.
