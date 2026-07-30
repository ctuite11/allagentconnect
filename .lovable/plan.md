## Holding — merge PR #31 first

No re-implementation, no new migration, no new components, no delegate logic changes while waiting. Nothing gets written until the merged code appears in this workspace.

Confirmed current workspace state (so we can tell merged from not-merged): latest migration is `20260727013950_*`, there is no `20260730160000_team_scoped_account_assistants.sql`, no `AssistantSection` component, and the three delegate edge functions have no `team_id` handling.

## Sequence once you merge PR #31 into main

1. **Confirm sync** — verify `supabase/migrations/20260730160000_team_scoped_account_assistants.sql` is present, plus the `AssistantSection` component and the `team_id` changes in `invite-account-delegate`, `accept-account-delegate-invite`, `revoke-account-delegate`. If any piece is missing, stop and report rather than filling the gap.
2. **Apply the migration** — exactly the file from the PR, unmodified. No supplementary or duplicate migration.
3. **Redeploy the three edge functions** — `invite-account-delegate`, `accept-account-delegate-invite`, `revoke-account-delegate`.
4. **Confirm mount points** — `AssistantSection` renders on Agent Edit Profile (below Basic Information), Manage Team (team-scoped, lead only), and Settings, all reading the same `agent_account_members` records.
5. **Run verification checks**
   - Personal: invite an assistant from the profile editor; confirm the identical record appears in Settings; resend and remove both work.
   - Team: invite the same email as a team assistant; confirm both rows coexist across scopes and a second invite within one scope is rejected.
   - Regression: an invite request with `team_id` omitted behaves identically to today's personal flow.
   - Scope: a team assistant gets team permissions only, cannot manage assistants, and cannot delete or transfer the team; a personal assistant gains no team access.
   - Gating: everything stays behind `agent_account_delegates`; assistants never appear on public profiles.

## Separate, still open

The off-market reminder 404 — `send-stale-listing-reminders` links to `/listing/:id/edit`, but the only registered route is `/agent/listings/edit/:id`. Unrelated to PR #31 and untouched by this plan. Say the word and I'll fix and redeploy that function on its own, either now or after the merge.
