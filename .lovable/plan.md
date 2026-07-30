## Goal
Remove only the listings created today (Jul 30, 2026) that currently have status "On MLS" (`active`).

## What's actually there
A query of the `listings` table shows 24 rows created today: 22 with status `active` (On MLS) and 2 drafts. All 22 active ones were inserted in a single burst at 17:51 UTC and look like bulk/seed data — listing numbers L-1251 through L-1272, spread across Boston, Cambridge, Plymouth, Worcester, Cape Cod, Springfield, Salem, Framingham, New Bedford, etc. The 2 drafts are untouched by this request.

## Plan
1. Run a database migration that deletes exactly those rows:
   - Scope: `status = 'active'` AND created today.
   - Also clean up child rows that reference those listings (status history, hot sheet sent-listing records, saved/favorited entries, comments) so nothing is orphaned — anything not already set to cascade gets an explicit delete first.
2. Re-query afterward to confirm zero active listings remain with today's creation date, and that the 2 drafts and all older listings are unchanged.

## Notes
- This is a hard delete, not an archive. If you'd rather flip them to `off_market` or `withdrawn` so history is preserved, say so and I'll switch the migration to an update instead.
- No emails are triggered by deletions, and outbound email remains paused, so this won't generate any notifications.
- "Today" is evaluated on the UTC date; all 22 rows were created mid-afternoon ET today, so the boundary isn't ambiguous.
