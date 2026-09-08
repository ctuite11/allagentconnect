# Make the Admin page load fast (especially on phones)

## What's slow right now

Three confirmed causes, measured against the live project:

1. **The page pulls the entire email history on every load.** To show the "Last Email" column, the admin data call reads every row in the email queue — 13,984 rows today, growing daily — sorts them, and keeps only the newest one per agent (at most ~478 rows are ever used). Everything else is thrown away after being read and transferred.
2. **Everything is sent to the phone in one big response.** 478 agent profiles, 226 access requests and 88 early-access leads arrive in a single payload before anything appears.
3. **Every row is drawn at once.** The list has no paging — roughly 790 rows, each with badges, buttons and tooltips, are all rendered immediately. On a phone this is the difference between "loaded" and "usable".

## The fix

**1. Ask the database for just the last email per agent**
Add a small read-only database function that returns one row per recipient (the newest email, its template and status), using the index that already exists for exactly this lookup. The admin data call uses that instead of downloading 14,000 rows. The Last Email column, its tooltip and sorting behave exactly as they do now.

**2. Show the list in pages**
Render a page of agents at a time (default 50) with simple next/previous controls and a count, instead of drawing all ~790 rows. Filters, search, sorting, selection and bulk actions keep working across the full list, not just the visible page — only what gets drawn changes.

**3. Trim per-row work**
The online-dot lookup currently rescans the whole agent list once per agent on every refresh; switch it to a direct lookup. No visual change.

Expected result: the admin data call drops from seconds to well under a second, and the page becomes interactive on a phone almost immediately instead of after a long freeze.

## Technical notes

- New migration: `SECURITY DEFINER`, `STABLE` function returning `DISTINCT ON (payload->>'to')` newest job per recipient (`sent_at`, `template`, `status`), executable by `service_role` only. It backs the existing `last_email` contract — no schema or data change to `email_jobs`.
- `supabase/functions/admin-list-agents/index.ts`: replace the unfiltered 20,000-row `email_jobs` select with the new RPC; keep the existing per-template map used for `invite_email` / `license_verified_email` by sourcing it from the same targeted lookup. Redeploy this function only.
- `src/pages/AdminApprovals.tsx`: add paging state over the already-filtered/sorted array; keep "select all" and exports operating on the full filtered set.
- `src/hooks/useAgentLastSeen.ts`: index the RPC result by `user_id` instead of `Array.find` per agent.

## Guardrails

No emails sent, queued, retried or modified. No changes to templates, agent records, statuses, verification, or any other page.
