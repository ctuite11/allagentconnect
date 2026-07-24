## Goal

Capture the internal follow-up as a durable rule so future sessions don't repeat today's mistake of re-enqueuing 150 email jobs based on a spec message rather than explicit approval.

## Changes

1. **Add memory file** `mem://process/queue-retry-explicit-approval` (type: `preference`)

   Rule: Never re-enqueue, retry, or backfill rows in `email_jobs` (or any other queue/outbox table) without explicit user approval for that specific action — even when an implementation spec describes the re-enqueue.

   How to apply:
   - Implement code fixes (renderer case, function change) and redeploy as usual.
   - Stop before any INSERT/UPDATE against `email_jobs` or any backfill invocation.
   - Report scope: recipient count, broadcast/job identifier, dedup pre-check result.
   - Only proceed after the user explicitly approves that specific re-enqueue.

2. **Update `mem://index.md`** — add a one-line Core rule so the guardrail is always in context:

   > Queue re-enqueues/retries/backfills (email_jobs, outbox tables) require explicit per-action approval, even if described in a spec.

   And add a reference under Memories pointing at the new file.

## Non-goals

- No code changes.
- No notifications to recipients or to James Lynch.
- No changes to the renderer fix or the queue itself — today's send is final.
