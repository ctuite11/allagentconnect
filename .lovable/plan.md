# Activated agents are always email-eligible

## Policy (as stated)
Once an agent completes account setup (activated), they have a profile and are eligible for Comms Center emails. A headshot is not required, and a missing profile record must never silently drop them.

This does not change opt-in: eligibility only decides who is *in* the audience. Whether they actually receive an email still depends on their Comms Center switches (missing row = OFF) and the global pause flag. Hot Sheets are untouched.

## What the audit found
- 210 verified + activated agents with the agent role.
- 7 of them have **no `agent_profiles` row at all**, so the shared audience builder finds no email for them and excludes them from every Comms Center send.
- Those 7 are not real gaps — they are leftovers from past deletions. Their auth users and `agent_settings` rows still exist, their `agent_profiles` rows were removed, and none of them has a `deleted_users` tombstone, so the earlier cleanup was partial:
  - nataliia.tuite@gmail.com
  - boo@allagentconnect.com
  - nataliia@directconnectmls.com
  - chris.tuite@compass.com
  - mbaltimore@gmail.com
  - n.lopachak@gmail.com
  - tuite.chris11@gmail.com — same orphan shape (auth user + settings, no profile), not in your list; confirm whether it should be purged too.
- Every agent with a profile row has a non-empty email, so there is no other silent exclusion.

## Changes

1. **Purge the orphaned accounts** (not backfill). Run the standard deletion path for the confirmed addresses so auth user, `agent_settings`, roles, and related rows all go, and a `deleted_users` tombstone is written. Nothing is emailed as part of this.

2. **Make activation self-sufficient going forward** (migration): ensure the activation RPC (`mark_agent_activated`) creates the `agent_profiles` row if one is missing, so a live activated agent can never exist without a profile.

3. **Harden the audience builder** (`supabase/functions/_shared/verifiedAgentAudience.ts`): keep the gate as VERIFIED + agent role + (ACTIVATED OR HAS_HEADSHOT), fall back to the auth email when the profile row is absent or blank, and update the header comment to state the rule plainly. This makes the "activated = eligible" rule hold even if a profile row goes missing again, rather than failing silently.

## Not in scope
- No change to opt-in semantics, digests, cadence, templates, or the Comms pause flag.
- No Hot Sheet changes.
- No emails sent as part of this work.

## Verification
After the purge, re-run the audit query: expect zero verified+activated agents without a profile row, and the eligible audience total to drop by the number of purged accounts. Opt-in state for everyone else stays unchanged.
