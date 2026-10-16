# Admin Approvals: show the 7 verified accounts that are missing agent profiles

## The cause

- tuite.chris11@gmail.com is a real, verified account (created June 4, 2026). The invite screen says the email is in use, and that's correct.
- The Admin Approvals list is built only from `agent_profiles`. Seven verified accounts have no `agent_profiles` row, so they never load and searching their emails finds nothing. The seven are chris.tuite@compass.com, n.lopachak@gmail.com, tuite.chris11@gmail.com, mbaltimore@gmail.com, nataliia.tuite@gmail.com, boo@allagentconnect.com and nataliia@directconnectmls.com.

## Smallest safe fix: change only how the admin list is read, with no new records

The fix is in one function, `admin-list-agents`, which feeds the admin page.

1. Alongside the reads it already runs in parallel, add one light read: the `user_id` column from `agent_settings`.
2. Find the IDs that have settings but no `agent_profiles` row. Today that's the 7 accounts.
3. For just those IDs, read name and email from `profiles` (the account record every sign-in already has). Then read their full settings with the existing chunked settings lookup.
4. Add them to the list using their real account ID and their saved status and activation dates. Mark them `profile_complete: false` with an AAC ID of "—". Search by email or name will then find them.

## Answers to your requirements

1. **Real identities, no duplicates.** Each row uses the existing account ID and verified status. Nothing is created.
2. **No new agent profiles.** The fallback alone fixes admin visibility. Whether the seven need full profiles is a separate decision for later.
3. **Not visible anywhere else.** Agent Network, Our Agents and matching all need an `agent_profiles` row. Since no rows are created, those screens stay exactly as they are.
4. **Database fields.** Not needed, because nothing is inserted.
5. **Nothing about the accounts changes.** Roles, verification and activation status, directory privacy and email preferences stay as they are.
6. **No automatic actions.** The change only reads data, so no emails, invitations, Hot Sheet notifications or queue entries.
7. **Stays fast.** The new work is one read of about 530 small ID values, plus two small lookups for the 7 accounts. All of it runs in parallel with the reads that already happen, so the admin page should load just as fast.

## One caution

Status buttons on the admin page (Verify, Reject and so on) already work by account ID, so they would work on these rows too. The plan doesn't change those buttons. Please don't use them on the seven old test accounts unless you mean to.

## Checks before release

- Before and after, the admin list total goes up by exactly 7. Searching tuite.chris11@gmail.com finds one row: "Chris Tuite", Verified.
- Agent Network and Our Agents still show the same count (332), and none of the seven appear.
- The email queue count is unchanged.
- Function deploy, type-check and build all pass.

## Left for later

- Whether to give any of the seven accounts full profiles.
- The friendlier wording on the invitation message.
