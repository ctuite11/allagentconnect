# Speed up the admin page

## What's happening now

A single admin page load currently takes about 6-7 seconds before anything appears. Measured from the live server logs for the last real load:

- about 1s to confirm the signed-in admin
- about 1s to read sign-in history
- about 2s to read agent records, settings, and early-access rows
- about 3s at the end purely to look up each agent's most recent emails (Last Email, Invite, License Verified columns) - roughly 1,500 separate lookups across 800 people

The whole roster (about 800 people, including bios) is then sent to the browser in one response, even though the table only shows 50 rows at a time.

## The fix

1. Show the table as soon as the roster is ready, and fill the email columns in right after. The email columns are the single biggest cost; splitting them out gets the list on screen in roughly 2 seconds instead of 6-7. The columns show a brief "-" placeholder and then populate.
2. Make the email lookup itself cheaper: one pass over the email history instead of three separate passes per person, using the indexes that already exist.
3. Read agent records, settings, early-access and access-request rows all at the same time instead of one after another, and stop splitting the settings read into batches.
4. Trim the response: drop the long bio text from the list payload (it isn't shown in the table), which cuts the download noticeably.
5. Keep the existing 5-minute cache, so moving away and back to the admin page stays instant.

Nothing about what the page shows changes: same people, same counts, same statuses, same columns, same actions. No emails are sent or queued.

## Last Email column - what it counts

Today that column shows the newest email of any type from an allowed list, and that list still includes mass sends: `bulk-email` (1,284 rows), plus the scheduled campaign emails `agent-activation-nudge` and `agent-missing-opportunities`. So a blast can hide the last personal email you sent that agent.

Fix: restrict the column to individual, person-to-person sends - invites and setup/login links, the ad-hoc admin email, the founder/forward invites, License Verified, verification submitted, approval accepted, account removed, delegate invite, team approved/requested. Mass sends (`bulk-email`, hot sheet blasts, listing alerts, client-need broadcasts, digests, match/message notifications) stay excluded. If an agent has only ever received blasts, the column reads "-".


## Technical details

- `supabase/functions/admin-list-agents/index.ts`: remove the trailing `admin_agent_email_summary` call from the main response; issue profiles / settings / early access / pending_verifications concurrently; replace the chunked `.in(user_id)` settings reads with one full-table select (501 rows); omit `bio` from the select list.
- New edge function `admin-agent-email-summary` (same admin JWT + `has_role('admin')` gate) returning `{ email, last_email, invite_email, license_verified_email }` for the roster, called by the page immediately after the agent list resolves.
- Replace the three lateral legs in `admin_agent_email_summary` with a single `DISTINCT ON (lower(payload->>'to'), template-bucket)` scan over `idx_email_jobs_lower_to_template_created_at`, preserving the existing allowlist semantics and the identical return shape. This is a function-body change only - no table, column, RLS or grant changes.
- `src/pages/AdminApprovals.tsx`: merge the email summary into agent state when it arrives; cache both parts under the existing `aac.adminAgents.<userId>` key; keep the 50-row paging and `clearAdminAgentsCache` behaviour untouched.

## Verification

- Compare agent count, lifecycle counts and status distribution before/after - must match exactly.
- Time both requests from the server logs and report the new numbers.
- Spot-check Last Email / Invite / License Verified values for several agents against the database.
- Confirm zero new `email_jobs` rows.
- Type-check and build; deploy only the two named functions; frontend publish left for your approval.
