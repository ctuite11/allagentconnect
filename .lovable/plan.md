# Why only 70 agents match "Massachusetts – All counties"

## What I verified in the database

Two separate things are shrinking the audience. Only the second one is a bug.

### 1. Opt-in policy (expected, working as designed)

Starting from 211 verified + eligible agents:

```text
211  verified + activated/headshot agents
-16  no notification_preferences row (opt-in policy: missing = OFF)
-74  master switch (Client Needs) turned OFF
-20  Buyer Need category turned OFF
=101 opted in to Buyer Need email
-18  globally unsubscribed / suppressed
= 83 deliverable
```

### 2. "All counties" silently drops every agent with a saved coverage area (bug)

```text
 83  deliverable
-12  agents whose saved Comms coverage is city/county level
 -1  the sender (self-excluded)
= 70  <- the number shown in the composer
```

All 216 saved Comms coverage rows are in MA, and every one of them names a specific
city (216) and/or county (90). None is a bare state-level row.

When "All counties" is selected, the composer sends `state: MA` with `counties: undefined`.
The edge function then builds a single location event `{ state: "MA" }` with no city or county.
The matcher requires each populated field on an agent's saved row to equal the event's
corresponding field — so a saved row for "Newton, Middlesex County, MA" is compared against
an event with an empty city and fails. The result is backwards: the broadest possible
geography matches only the agents who saved *no* geography at all, and excludes every agent
who actually told us they cover Massachusetts.

## The fix

Make a state-only broadcast mean "anywhere in this state" instead of "state field only".

1. `supabase/functions/_shared/communicationPreferencesMatcher.ts`
   - Add an opt-in event flag (`stateWide: true`). When set, a saved geo row passes location
     if its state matches the event state, regardless of city / county / zip / neighborhood.
   - Default behavior for every existing caller (Hot Sheets, new-match, price-change) stays
     identical — the flag is off unless explicitly passed.

2. `supabase/functions/send-client-need-notification/index.ts`
   - When the criteria contain a state but no city, county, or neighborhood, emit the
     state-level event with `stateWide: true`.
   - Any narrower selection (specific counties or towns) keeps today's exact-match behavior.

3. No change to the opt-in policy, no change to who is opted in, no data writes, no
   Hot Sheet changes.

## Expected result after the fix

"Massachusetts – All counties" would preview 82 recipients instead of 70 (the 12 agents with
MA coverage areas come back in). The remaining gap from 211 is entirely the opt-in policy,
which is intentional.

## Verification

- Preview the same Buyer Need with "All counties" and confirm the count rises to 82 and the
  12 coverage-area agents appear in the recipient list.
- Preview with a single county selected and confirm the count is unchanged from today.
- Confirm Hot Sheet / new-match matching output is unchanged (flag not passed there).