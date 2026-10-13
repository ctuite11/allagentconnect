# Restore Communications Center emails for chris@allagentconnect.com (stay hidden)

## Goal
Chris keeps his "hidden from the Agent Network directory" setting and gets Communications Center emails again, filtered by his saved preferences. No other account changes.

## Cause (confirmed)
- Every email path picks recipients from the same list of agents who appear in the directory. Agents marked hidden are left off that list.
- Chris is marked hidden, so he's dropped before his preferences are checked. His preferences, his address and delivery all check out fine.

## The change
1. **New per-account switch, off for everyone.** Add a field on agent settings called "receive Communications emails while hidden from the directory". It's off by default for every account.
2. **Turn it on for Chris only.** Make a one-row change on Chris's account (user `1fc50da1-…`). This isn't tied to the admin role, so other admins and other hidden agents stay excluded.
3. **Add Chris back to the email list only.** The email recipient list adds verified, activated agents who have this switch on. The directory lookup used by the Agent Network and Our Agents pages stays exactly as it is, so Chris stays hidden there.
4. **All filters still apply.** Chris then goes through the usual checks: master switches, category toggles, Boston/Suffolk area, $1M minimum, property types, timing, the sender exclusion, global blocks and duplicate protection.

## Who it affects
- Only accounts with the switch on. After the change that's Chris and nobody else.
- Agent Network, Our Agents and the sign-in hints: no change.
- Hot Sheet matching and delivery: no change. They don't use this list.
- Paths that will now include Chris, still filtered by his preferences: buyer, renter, sales and discussion broadcasts, daily and weekly summaries, broadcast re-sends, buyer-need notices, the general agent notices from `notify-agents`, and seller alerts. These are the normal agent emails every visible agent already gets. If you want only the core Communications Center emails, I can limit it to broadcasts, summaries and re-sends.

## What's not included
- No emails, test sends, re-sends of past messages, invitations or catch-up sends. Chris only gets emails for activity after the change.
- No change to global email settings, to other agents' settings, or to directory visibility.

## Checks
- Automated tests: a hidden agent without the switch stays excluded, a hidden agent with it is included, and the directory list is unchanged.
- Read-only checks: the directory list size before and after is identical, exactly one account has the switch on, and a dry-run preview of the Sep 29 statewide broadcast would include Chris. Dry-run previews send nothing.

## Technical details
- Database migration: add `agent_settings.comms_email_when_hidden boolean NOT NULL DEFAULT false`. Add a new SECURITY DEFINER function `get_comms_hidden_optin_agent_ids()` that applies the same verified, activated, role and name rules as `get_verified_agent_ids()`, plus `hide_from_directory = true AND comms_email_when_hidden = true`. Execute is granted to service_role only.
- One data update: set the flag true for user `1fc50da1-2664-4931-8cab-64e24dc5ed8c`.
- `supabase/functions/_shared/verifiedAgentAudience.ts`: `loadVerifiedAgentIdSet` unions the new function's IDs into the set. The `get_verified_agent_ids()` function itself stays as it is.
- Redeploy the edge functions that import the helper (send-client-need-notification, process-comms-digests, resend-comms-broadcast, notify-agents, notify-agents-client-need, send-seller-alert). If the "core only" option is chosen, the union instead goes into a new helper used by just the first three.
- Record the rule in AGENTS.md: directory visibility and email eligibility are separate, with an explicit per-account switch.
