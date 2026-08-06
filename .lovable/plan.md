# Renter Need broadcast: why you didn't get the email

## What actually happened

The 15:38 UTC "FURNISHED RENTAL OPPORTUNITY | Charlestown Navy Yard" Renter Need broadcast
(sent by Rachel, 76 recipients) did send correctly:

```text
72  immediate emails queued and sent  (69 delivered, 2 sent/pending, 1 delayed)
 4  queued as daily-digest items instead of immediate
 0  failures
```

So the broadcast pipeline is healthy. The issue is that your account was not in the audience.

## Root cause

Every Communications Center broadcast builds its audience from the Agent Network function
`get_verified_agent_ids()`. That function requires, among other things:

```text
hide_from_directory = false
```

Your account (chris@allagentconnect.com) has `hide_from_directory = true`. Everything else on
your account is correct: verified, activated, agent role, all four Comms categories on, immediate
cadence, no price/property-type restriction, no suppression.

So a *directory visibility* setting is silently controlling *email eligibility*. Hiding yourself
from the member directory also removes you from every Comms Center broadcast, with no indication
anywhere in the UI.

## Proposed work

1. Separate the two concerns. Directory visibility should not decide email eligibility.
   Add a dedicated audience function for Comms Center broadcasts that keeps the verified +
   activated + agent-role + named-profile gates but drops the `hide_from_directory` condition.
   The Agent Network directory itself keeps using the existing function unchanged, so hidden
   agents stay hidden in the member directory.
2. Point the broadcast audience loader at the new function. No change to opt-in gates, category
   matching, cadence, suppression, or the email templates.
3. Verify by re-running the audience calculation for the same Renter Need criteria and confirming
   your account now appears as a recipient — read-only, with no email sent.

Not in scope: no changes to Hot Sheets, email templates, crons, pause switches, or any re-send of
the 15:38 broadcast.

## Technical notes

- New `public.get_comms_audience_agent_ids()`, identical to `get_verified_agent_ids()` minus
  `s.hide_from_directory = false`. Existing function untouched.
- `supabase/functions/_shared/verifiedAgentAudience.ts` (`loadVerifiedAgentIdSet`) switches to the
  new function; the rest of the audience/matcher chain is unchanged.
- Affected functions to redeploy: the Comms Center broadcast senders that import the shared
  audience module.
- Alternative if you prefer zero schema change: flip `hide_from_directory` to false on your
  account only. That fixes your inbox immediately but leaves the same trap for any other hidden
  agent, so it is a workaround rather than a fix.
