# Email stream mapping fix + completeness audit

## Why emails silently got stuck

Every queued email gets a delivery lane ("stream") from its template name, taken from a list held in the database. If a template is not on the list, the system fails closed: the email is stored with no lane and the sender permanently skips it — no error, no retry. That is what happened to Austyn's activation reminder and to three older Team Approved emails.

## Completeness audit (read-only, already done)

I collected every email template name emitted anywhere in the app, the edge functions and the admin email flows, plus every template that has ever appeared in the queue, and checked each against the mapping list.

Unmapped names found, and what they are:

| Template | Verdict |
|---|---|
| `agent-activation-reminder` | Active, new — **fix in this migration** |
| `team-approved` | Active — **fix in this migration** |
| `team-rejected` | Active, same decision pair — **fix in this migration** |
| `agent-missing-opportunities` | **Active and unmapped — reporting only, not changing.** The "You're missing opportunities" reminder still enqueues under this name, so a future send would get stuck the same way. 167 historical sends predate the lane system. Its natural lane is `communications` (alongside `agent-activation-nudge`), but you asked to be told before any extra mapping, so it is not in this migration. |
| `agent-new-listing-alert` | Intentionally retired and permanently blocked — correctly unmapped, leave as is |
| `custom`, `new-listing-alert` | Not real queue templates — `custom` is a dropdown value in the admin email dialog (sends as `bulk-email`), `new-listing-alert` only appears in a code comment. No action |

Everything else emitted by the code is already mapped correctly.

## The migration

One additive migration, `email_stream_for_template` recreated with the current live body plus three entries:

- `agent-activation-reminder` → `transactional`
- `team-approved` → `transactional`
- `team-rejected` → `transactional`

All other mappings byte-for-byte unchanged; unknown templates still return nothing (fail closed). No table, RLS, trigger, queue, edge function, or frontend change. The migration file is committed to the repo so source control matches production.

## Verification after applying

- the three templates each return `transactional`
- every previously mapped template returns exactly its prior value (full before/after comparison)
- Austyn's reminder row: still queued, 0 attempts, stream still empty
- the three historical Team Approved rows: untouched
- any historical Team Rejected rows: untouched and unreleased
- queue counts and send counts unchanged; no email sent by the migration

Then I stop and report. Nothing is repaired or released — Austyn's row only goes out when you say so.

## Technical details

- Migration `0011_email_stream_activation_reminder_team_decision`: `CREATE OR REPLACE FUNCTION public.email_stream_for_template(p_template text)` sourced from the deployed definition + three `WHEN` branches. `email_jobs_enforce_stream` and `email_jobs_claim` untouched.
- Because the trigger only assigns a stream on insert, existing NULL-stream rows stay unclaimable after the migration — that is why nothing is released.
- Reference rows (untouched): reminder `b33d9f8a-3d88-46d0-8179-842fd4eee7ab`; team-approved `51c8f7f2-…`, `db87549a-…`, `b6b0050c-…`. No `team-rejected` rows exist in the queue.
