# Fix Agent Profile Back Navigation

## Goal
When the Agent Profile (`/agent/:idOrCode`) is opened from anywhere — Listing Detail, listing cards, Network Activity, Messages, Comms Center, Agent Network — the Back button must return to that origin, not always to Agent Network.

## Approach
Standard React Router pattern: pass `state.from` on navigation, and have Agent Profile prefer `location.state.from` when rendering its Back button. Falls back to the current default (`/our-agents` public, `/our-members` in‑app) when no origin is supplied (direct links, refresh, etc.).

## Changes

### 1. `src/pages/AgentProfile.tsx` — Back button reads origin
- Add `useLocation()`.
- Compute `backTo = (location.state as any)?.from ?? (publicMode ? "/our-agents" : "/our-members")`.
- Update the `AacBackButton` onClick (line 372) to `navigate(backTo)`.
- Also update the "Agent not found" fallback (line 232) to use the same `backTo`.

### 2. Add `state: { from: location.pathname + location.search }` at every call site that navigates to `/agent/:id` and does not already pass it

Already correct (leave as‑is):
- `src/pages/PropertyDetail.tsx` L1070
- `src/pages/AgentListingDetail.tsx` L1008
- `src/components/PropertyDetailRightColumn.tsx` L194
- `src/pages/AgentProfileEditor.tsx` L338

Needs `state.from` added (add `useLocation` where missing):
- `src/pages/TeamProfile.tsx` L357
- `src/pages/OurAgents.tsx` L374
- `src/pages/Conversation.tsx` L138 (Messages)
- `src/components/BuyerAgentShowcase.tsx` L165
- `src/components/PropertyCard.tsx` L178 and L191
- `src/components/MatchingBuyerAgents.tsx` L157
- `src/components/success-hub/networkActivity/NetworkActivitySection.tsx` L111
- `src/components/communication-center/RecipientListDialog.tsx` L55 — convert `<Link to={...}>` to `<Link to={...} state={{ from: location.pathname + location.search }}>` (add `useLocation`).

## Out of scope
- No changes to `backTargets.ts` (its `/agents/:id` rule is unused — Agent Profile renders its own Back button).
- No scroll‑restoration work; React Router's default behavior preserves history scroll on browser back, but `navigate(path)` is a push so exact scroll restoration on the origin page is not guaranteed. Will only be achieved when the browser/back‑forward cache restores it; no new infra added.
- No changes to upload, DB, or RLS.

## Verification
1. Listing Detail → click agent → Agent Profile → Back returns to that listing.
2. Network Activity row → Agent Profile → Back returns to Success Hub.
3. Messages thread header avatar → Agent Profile → Back returns to that conversation.
4. Direct visit to `/agent/<id>` (no state) → Back goes to `/our-members` (in‑app) or `/our-agents` (public) — unchanged.
