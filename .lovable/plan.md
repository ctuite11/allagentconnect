# Restore core Communications Center emails for chris@allagentconnect.com (stay hidden)

## Goal
Chris stays hidden from the Agent Network and Our Agents, and receives core Communications Center emails again, filtered by his saved preferences. No other account is affected.

## Cause (confirmed)
Communications emails go only to agents who appear in the directory. Chris is marked hidden, so he is left out before his preferences are checked. His preferences, address and delivery are all fine.

## The change
1. **New per-account switch, off for everyone.** Add `comms_email_when_hidden` on agent settings, off by default.
2. **Turn it on for Chris only.** One row changes. It is not tied to the admin role.
3. **Core Communications emails only.** A new email-only recipient list includes the switch. Only these three use it:
   - Communications broadcasts (buyer, renter, sales and discussion)
   - Daily and weekly Communications summaries
   - Re-sends of a Communications broadcast
4. **Everything else stays as it is.** Seller alerts, general agent notices, buyer-need notices, Hot Sheet emails, the Agent Network and Our Agents keep using the current list, so they still exclude Chris.
5. **All filters still apply.** Master switches, category toggles, Boston/Suffolk area, $1M minimum, property types, timing, the sender exclusion, verification and activation checks, global blocks and duplicate protection.

## Past messages can't be sent (checked)
- **Summaries:** Chris has 0 waiting summary items. Summaries only send items that were saved for that agent when a broadcast went out. Hidden agents were never given items, so turning the switch on has nothing old to send. Only broadcasts sent after the change can reach him.
- **Waiting deliveries:** no queue rows are added, re-run or changed.
- **Re-sends:** these only run when an admin manually re-sends one broadcast, and none have run in the last day. One thing to know: if an admin re-sends an older broadcast after this change, Chris could receive it if it matches his preferences, the same as any agent who missed the original.

## Checks before going live (no emails)
- Automated tests: a hidden agent without the switch is excluded; with the switch they're included in the core Communications list only; the directory list and the other email lists are unchanged.
- Read-only checks: exactly one account has the switch on, the directory list count is the same before and after, Chris still has 0 waiting summary items, and the email queue count is unchanged.
- A dry-run preview of the Sep 29 statewide broadcast shows Chris included. Dry runs send nothing.

## After going live, I'll report
The exact functions changed, the test results, and the email queue count before and after (zero emails sent).

## Technical details
- Migration: add `agent_settings.comms_email_when_hidden boolean NOT NULL DEFAULT false`. Add a new SECURITY DEFINER function `get_comms_hidden_optin_agent_ids()`, which mirrors `get_verified_agent_ids()` filters plus `hide_from_directory = true AND comms_email_when_hidden = true`. Execute revoked from public and granted to service_role only.
- Data: set the flag true for `1fc50da1-2664-4931-8cab-64e24dc5ed8c` only.
- `_shared/verifiedAgentAudience.ts`: add opt-in parameters `{ includeCommsHiddenOptIn?: boolean }` to `loadVerifiedAgentIdSet` and `getVerifiedAgentAudienceWithStats`, default false. Existing callers are unchanged.
- Pass `true` only in `send-client-need-notification`, `process-comms-digests` and `resend-comms-broadcast`. `notify-agents`, `notify-agents-client-need` and `send-seller-alert` are untouched.
- Add tests in `_shared`. Record in AGENTS.md: directory visibility and Communications email eligibility are separate, using an explicit per-account switch.
