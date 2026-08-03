# Communications Center — Read-Only Audit (Aug 3, 2026)

Scope: Comms Center only. Hot Sheets and every other system were not touched and are not part of this plan.

## How it is set up today

Surfaces
- `/communications` (ClientNeedsDashboard) — channel switches, coverage area, property type, price range, notification timing.
- `/communications/feed` (CommunicationsFeed) — in-app network activity list. Both routes are agent-role guarded.

Delivery pipeline
```text
broadcast / client need
  -> notify-agents-client-need | send-client-need-notification | notify-agents | send-seller-alert
  -> verifiedAgentAudience  (verified + agent role + (activated OR headshot), suppression list applied)
  -> commsOptIn             (opt-in gate: missing prefs row = OFF, master switches + category must be true)
  -> timing split (commsDigest.loadCommsSchedules)
       immediate -> email_jobs (stream = "communications")
       daily/weekly -> comms_digest_items -> process-comms-digests -> email_jobs
  -> process-email-queue (per-stream pause flags: EMAIL_SENDING_PAUSED, COMMS_EMAILS_PAUSED)
```

Opt-in policy (implemented as specified)
- Missing `notification_preferences` row = everything off; null values render and evaluate as OFF.
- `client_needs_enabled` + `new_matches_enabled` are master switches; both must be true.
- Category column (`buyer_need`, `sales_intel`, `renter_need`, `general_discussion`) must be explicitly true.
- Unknown/blank category = blocked, never borrows another category's permission.
- Preference lookup failure fails closed for sending, and for digests preserves items for retry instead of retiring them.

## Current live state (verified by query)

- `notification_preferences`: 194 rows; 120 with both master switches on; per-category on: buyer_need 100, sales_intel 101, renter_need 90, general_discussion 104.
- Timing: 167 immediate, 18 daily, 9 weekly.
- Comms email traffic (14 days): 995 `client-need-broadcast` sent (latest Aug 3, 17:48 UTC), 176 `comms-center-guide`, 5 `bulk-email`, 150 failed on Jul 24. No comms jobs currently pending — the queue is clear.
- Crons: `process-comms-digests` every 15 min (active), `process-email-queue` every minute (active). Hot Sheet match/price/stale crons remain inactive.

## Confirmed defect: daily and weekly digests never send

- `comms_digest_items` holds 8 unsent rows (6 daily, 2 weekly) created Aug 3 17:48 UTC.
- `comms_digest_sends` is completely empty — no digest has ever been attempted.
- The digest send window (after 18:00 ET) has been open since 22:00 UTC and the cron ran successfully at 22:00, 22:15, 22:30, 22:45 and 23:00 UTC.
- Root cause (confirmed, not inferred): the cron calls `public.invoke_process_comms_digests()`, which reads `current_setting('supabase.service_role_key')`. That GUC is empty (`length = 0`), so the function logs `supabase.service_role_key GUC is empty; skipping` and returns without ever calling the edge function. Postgres logs show that exact warning on the most recent run, and edge logs show zero invocations of `process-comms-digests`.
- Effect: the 27 agents on daily/weekly timing receive no Comms Center email at all. The immediate path (167 agents) is working normally.

## Secondary observation (not yet a confirmed bug)

`ClientNeedsDashboard.tsx` line ~434 writes only `client_needs_enabled: false` when muting, while the shared helper `muteAllChannels()` in `src/lib/commsChannelPrefs.ts` clears both master switches and all four categories. Delivery is still correctly muted (either master switch off blocks everything), but the stored row is left inconsistent with the helper's contract.

## Proposed follow-up (no changes made yet — approval required)

1. Fix digest dispatch: replace the empty-GUC dependency in `invoke_process_comms_digests` with a working authorization source (same pattern the other active crons use), via a new dated migration. No re-enqueue or backfill of the 8 existing pending items unless you explicitly approve that separately.
2. Verify after the fix by watching one digest window and confirming `comms_digest_sends` rows appear.
3. Optional: align the dashboard mute action with `muteAllChannels()` so stored preference rows stay consistent.

Nothing in this audit changed code, data, secrets, crons, or queues.
