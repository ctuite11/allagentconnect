# Activated agents are always email-eligible

## Policy (as stated)
Once an agent completes account setup (activated), they have a profile and are eligible for Comms Center emails. A headshot is not required, and a missing profile record must never silently drop them.

This does not change opt-in: eligibility only decides who is *in* the audience. Whether they actually receive an email still depends on their Comms Center switches (missing row = OFF) and the global pause flag. Hot Sheets are untouched.

## What the audit found
- 210 verified + activated agents with the agent role.
- 7 of them have **no `agent_profiles` row at all**, so the shared audience builder finds no email for them and excludes them from every Comms Center send:
  - nataliia.tuite@gmail.com
  - boo@allagentconnect.com
  - nataliia@directconnectmls.com
  - chris.tuite@compass.com
  - tuite.chris11@gmail.com
  - mbaltimore@gmail.com
  - n.lopachak@gmail.com
- Everyone else with a profile row has a non-empty email.

## Changes

1. **Backfill the 7 missing profile rows** (migration): insert an `agent_profiles` row keyed to the auth user id with the auth email, leaving name/company/headshot blank. Purely additive; no existing rows touched.

2. **Make activation self-sufficient going forward** (migration): ensure the activation RPC (`mark_agent_activated`) creates the profile row if one is missing, so an activated agent can never exist without a profile.

3. **Harden the audience builder** (`supabase/functions/_shared/verifiedAgentAudience.ts`): keep the gate as VERIFIED + agent role + (ACTIVATED OR HAS_HEADSHOT), but fall back to the auth email when the profile row is absent or its email is blank, and drop the implicit "no profile row = excluded" behavior. Update the header comment to state the rule plainly.

## Not in scope
- No change to opt-in semantics, digests, cadence, templates, or the Comms pause flag.
- No Hot Sheet changes.
- No emails sent as part of this work.

## Verification
Re-run the audience count before/after: expect activated+verified agents in the audience to go from 203 to 210, with the 7 named accounts present and their opt-in state unchanged (all still OFF unless they've configured Comms Center).
