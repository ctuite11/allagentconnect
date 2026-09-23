# Remove the old Agent Network intro popup entirely

The Member Setup Checklist is the single onboarding system for incomplete setup. The separate Agent Network intro overlay (added in June) duplicates that job, so it is removed outright — no replacement dismissal logic, no new database field.

The earlier draft (improve-the-intro approach) is cancelled; its `agent_network_intro_dismissed` field and server-side dismissal logic are NOT built.

## Changes

### Delete (3 files, used only by this popup)
- `src/hooks/useAgentNetworkIntro.ts` — the intro visibility/dismissal hook
- `src/lib/agentNetworkIntro.ts` — its localStorage/sessionStorage key helpers
- `src/components/agent-directory/AgentNetworkIntroOverlay.tsx` — the overlay component itself

### Edit (1 file)
- `src/pages/OurAgents.tsx`
  - Remove the two imports (`AgentNetworkIntroOverlay`, `useAgentNetworkIntro`)
  - Remove the `useAgentNetworkIntro(...)` hook call and its four destructured handlers
  - Remove the `<AgentNetworkIntroOverlay ... />` block from the page render
  - Keep the "See Profile" navigation behavior it triggered available through normal page navigation — the overlay's special-cased navigate calls go away with it; nothing else on the page depends on them

## Explicitly unchanged
- Member Setup Checklist (useAgentProfileOnboarding / AgentProfileOnboardingOverlay) — untouched; it remains the one onboarding surface
- Agent Network visibility, directory, and discovery rules — untouched
- No database migration (no `agent_network_intro_dismissed` column)
- No changes to emails, queues, Hot Sheets, or any edge function
- Leftover localStorage/sessionStorage keys in existing browsers are simply never read again (harmless); no cleanup code added

## Verification
- Type-check and lint clean; build-errors.log clean
- Confirm no remaining references to the intro anywhere in `src/`
- Reason through the Our Agents page: it renders with no onboarding overlay in any session state (fresh browser, incognito, returning user)

## Delivery
- Report the exact files changed/deleted, then STOP
- No publish; note that once this reaches GitHub main it auto-deploys to allagentconnect.com
