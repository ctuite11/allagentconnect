## Move ONLINE status to avatar

In `src/components/agent-search/AgentMarketplaceCard.tsx`, the "ONLINE" pill renders as a separate row inside the card body, which makes online agents' cards taller than offline ones (visible in the screenshot: Stephanie's card is taller than William's).

`AgentAvatar` already supports an `isOnline` prop that renders a presence dot on the photo, and it's already being passed. The redundant text pill row below the name is what's causing the height difference.

### Change
- Remove the standalone "ONLINE" badge row from `AgentMarketplaceCard.tsx` so the presence signal lives only on the avatar (green dot), keeping every card the same height.
- No other changes — avatar dot behavior, data flow, and layout tokens are untouched.
