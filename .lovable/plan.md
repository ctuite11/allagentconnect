# Fix the email stream mapping (no emails released)

## Why the reminder never sent

Every queued email is assigned a delivery lane ("stream") from its template name. The list of template-to-lane mappings lives in the database. `agent-activation-reminder` was never added to it, so the system failed closed: the email was stored with no lane, and the sender skips anything without one. Result: queued forever, 0 attempts, no error.

Three historical `team-approved` emails (Aug 31, Sep 10) are stuck for exactly the same reason.

## Team Approved — correct lane

Team Approved is an admin decision notice sent directly to the team lead, the same category as `team-invite`, `team-request-notification` and `team-decision`, which are all mapped to the **transactional** lane. So `team-approved` → `transactional` is the intended lane.

Finding to flag: `team-rejected` (the other half of the same decision email) is **also** missing from the mapping and would get stuck the same way. It is not in the scope you gave me, so this migration will not touch it. Say the word and I'll add it in a follow-up.

## The migration

One migration, additive only:

- `agent-activation-reminder` → `transactional`
- `team-approved` → `transactional`
- every other existing mapping copied byte-for-byte, unchanged
- unknown templates still return nothing (fail closed) — that safety behavior stays

Nothing else changes: no table, RLS, trigger, queue, edge function, or frontend change. No row is repaired or released, so the migration itself sends no email.

## Verification after applying

- `agent-activation-reminder` returns `transactional`
- `team-approved` returns `transactional`
- all previously mapped templates return exactly what they returned before (full before/after comparison)
- Austyn's reminder row is still queued, 0 attempts, no stream
- the three old Team Approved rows are untouched
- no new sends, no change in queue counts

Then I stop and report. Austyn's row stays queued; the three old Team Approved rows stay stuck until you say otherwise.

## Technical details

- Migration `0011_email_stream_activation_reminder_team_approved`: `CREATE OR REPLACE FUNCTION public.email_stream_for_template(p_template text)` with the current live body plus two `WHEN` branches.
- Live body sourced from the deployed definition; `email_jobs_enforce_stream` and `email_jobs_claim` are not modified.
- Stuck rows for reference (untouched): reminder `b33d9f8a-3d88-46d0-8179-842fd4eee7ab`; team-approved `51c8f7f2-…`, `db87549a-…`, `b6b0050c-…`.
- Migration file lands in the repo so production and source control stay aligned.
