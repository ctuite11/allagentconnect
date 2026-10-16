# Email search finds zero matches for an existing agent

## What happened

- tuite.chris11@gmail.com **already has a verified agent account** (created June 4, 2026; roles: agent + buyer; not hidden, not deleted). The invite screen's "this email is in use" message is **correct** — an existing account can't be invited again.
- The **zero search matches** are the real gap: the Agent Network directory search (`src/lib/agentDirectorySearch.ts`) only matches name, brokerage, and team name. It never looks at email, so typing an email address always returns zero results — even for agents who exist.

## Plan

1. **Add email matching to the Agent Network directory search.**
   - Include the agent's email as a searchable field in `matchesAgentDirectorySearch` (same token matching as other fields).
   - Directory cards already display per existing rules; this only affects which cards match a query — no change to who appears in the directory, visibility rules, or anti-scraping protections.
2. **Add/extend tests** alongside the existing search tests: full email matches the right agent; partial email token matches; name/brokerage/team behavior unchanged.
3. **Verify:** type-check, focused tests, build. No deploy without approval.

## Notes

- No data changes, no emails, no invitations.
- The invite flow stays as-is: existing accounts correctly block new invites. If you want a friendlier message there (e.g. "This person already has an account" with their name), say so and I'll add it.
