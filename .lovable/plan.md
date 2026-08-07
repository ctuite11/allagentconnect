# Fix: Comms Center emails silently skip agents with saved town coverage

## What's happening

Gabrielle Russo is fully eligible — she is in the Agent Network, her Comms Center
channels are all On, all 8 property types are selected, no price limits, and she
is not unsubscribed. Yet she has received **zero** of the last six Communications
broadcasts (Aug 4–7), while 70–81 other agents received each one.

## Verified root cause

When an agent saves coverage areas in the Comms Center, the app must store a ZIP
because that column is required and part of a uniqueness rule. It stores a
**fake placeholder ZIP** instead — a simple counter: `00000`, `00001`, `00002`,
… one per town. Gabrielle has 346 towns saved, so 346 different fake ZIPs.

The matching engine ignores only two of those placeholders (`00000` and `00001`)
and treats every other value as a real ZIP the listing must equal. Since no
listing ever has ZIP `00002`, every town row past the second one can never match.
Effectively only her first two towns (Abington, Acton) are live; the other 344 are
dead, so almost nothing reaches her.

This is not specific to her: **18 agents / 253 saved coverage rows** carry these
placeholder ZIPs today, and they have been quietly under-receiving.

## The fix

1. **Matcher: ignore ZIP on Comms Center coverage rows.**
   Comms Center coverage is chosen by town/state, never by ZIP, so the audience
   builder will drop the placeholder ZIP when it loads `source='notifications'`
   rows. Matching then happens on state + county + town, which is what the agent
   actually selected.
2. **Keep the stored placeholder as-is.** It only exists to satisfy the database's
   required/unique ZIP rule. No data migration and no risk to existing rows.
3. **Verify before/after** with a read-only recheck of the six recent broadcasts:
   confirm Gabrielle (and the other 17 affected agents) now fall inside the
   matched audience, and confirm no previously-matched agent drops out.
4. **No back-sending.** Missed broadcasts will not be re-enqueued or re-sent; the
   fix applies to future sends only, per the standing queue-approval rule.

## Technical detail

- `supabase/functions/_shared/verifiedAgentAudience.ts` — when building
  `savedPrefs.geoRows` from `agent_buyer_coverage_areas` (`source='notifications'`),
  set `zip_code: null`.
- `supabase/functions/_shared/communicationPreferencesMatcher.ts` unchanged
  (its `ZIP_SENTINELS` set stays as a defensive fallback).
- Redeploy the Comms producers that build the audience:
  `notify-agents-client-need`, `notify-agents-broadcast` / Comms broadcast
  functions, and the digest processor.
- Add a unit test covering: town-only coverage row with a placeholder ZIP matches
  a listing in that town; a genuinely different town still does not match.
