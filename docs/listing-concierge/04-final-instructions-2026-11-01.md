# Final instructions (Chris Tuite, 2026-11-01)

Approved: workflow design, five subject lines, button labels and destinations (see 03-...md).
NOT approved: production implementation, activation, sending. Reminders stay OFF everywhere.

## Listing confirmation must be intentional
- Opening `/agent/listings/:id/confirm` (GET) must NEVER record anything. Email scanners and link prefetchers open links automatically.
- The page requires sign-in, checks `can_act_for_agent`, shows the listing summary and a "Confirm listing is accurate" button.
- Only that button click (POST / RPC `confirm_listing_accurate`) records `confirmed_at`, `confirmed_by`, `agent_last_touched_at`.
- Required tests: GET with valid session records nothing; unauthenticated GET/POST record nothing; unauthorized user's POST rejected; authorized agent and accepted assistant POST succeeds; repeat POST is a no-op.

## Preview crash fix — held back from production
- Removed from the AAC project's `vite.config.ts`; production is unchanged.
- The proposed setting is in `patches/vite-dedupe-preview-fix.diff` for review only.
- Nenad: review your real build config. Apply only if your environment actually shows two React/router copies (e.g. `npm ls react react-router-dom`). Do not copy it by default.

## Gate
Full test suite must pass in Nenad's independent Supabase/Netlify environment, then Chris approves production release separately. First audience: 18 never-updated listings / 18 agents + their accepted assistants. Respect unsubscribes; idempotent per recipient per event.
