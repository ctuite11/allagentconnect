## Goal
Replace the mock "Newest Verified Agents" row on the Success Hub dashboard with live data so each card shows the real agent's headshot, name, brokerage, and market.

## Where
- `src/components/success-hub/networkActivity/NetworkActivitySection.tsx` — `NewestVerifiedAgentsRow` component (currently maps over `MOCK_VERIFIED_AGENTS` and passes `headshotUrl={null}`).

## Changes

1. **New hook** `src/components/success-hub/networkActivity/useNewestVerifiedAgents.ts`
   - Query `agent_profiles` joined with `user_roles` where `role = 'agent'` (verified agent), ordered by `created_at desc`, limit 12.
   - Select: `id, first_name, last_name, company, headshot_url, office_city, office_state`.
   - Return `{ agents, loading }` where each agent is normalized to:
     ```ts
     { id, name: "First Last", brokerage: company ?? "", market: "City, ST" | "", headshotUrl }
     ```

2. **Update `NewestVerifiedAgentsRow`**
   - Use the new hook instead of `MOCK_VERIFIED_AGENTS`.
   - Pass `headshotUrl={agent.headshotUrl}` into `AgentAvatar` (it already handles fallback initials).
   - Keep current card layout, sizes, snap scroll, and styling untouched.
   - While loading, render 6 skeleton cards matching existing card width/height to avoid layout shift.
   - If no agents returned, render the existing mock fallback so the row never looks empty (optional safety; keep behavior unchanged otherwise).

3. **Make each card clickable** → navigate to that agent's profile (`/agent/{id}`) using existing routing convention. (Small additive change; preserves visual shell.)

## Out of scope
- No changes to mock data file (kept for fallback / other consumers).
- No layout, color, or copy changes.
- No changes to the four channel cards below the agents row.

## Verification
- Open `/agent-dashboard` on desktop and mobile — confirm row shows real headshots from `agent-headshots` storage bucket.
- Hard refresh: skeletons appear briefly then real avatars.
- Cards with no `headshot_url` fall back to initials via `AgentAvatar`.
