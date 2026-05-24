## Goal

Show an online/offline indicator for each agent row in the Admin panel (`/admin/approvals` — `src/pages/AdminApprovals.tsx`), reusing the existing presence system.

## Approach

The project already has a presence system:
- `agent_presence.last_seen_at` updated by `useAgentPresence` heartbeat
- `useAgentPresenceBatch(userIds)` hook returns `{ lastSeenAt, isOnline }` per user (5‑min threshold, 60s refresh)
- `AgentOnlinePresenceBadge` component renders the canonical AAC "Online" pill

We'll wire these into the admin table — no new DB tables, no new heartbeat logic.

## Changes

**`src/pages/AdminApprovals.tsx`**
1. Import `useAgentPresenceBatch` and `AgentOnlinePresenceBadge`.
2. Compute `realAgentIds = agents.filter(a => !a.is_early_access).map(a => a.id)` (early-access rows have no auth user, so no presence).
3. `const presence = useAgentPresenceBatch(realAgentIds);`
4. In the row at line ~911, next to the agent name, render the badge when `presence.get(agent.id)?.isOnline` is true. For offline real agents, render a subtle muted dot + "Offline" (or nothing — see question).
5. Add an optional small "Last seen" timestamp tooltip on hover for offline agents (using `lastSeenAt`).

## Out of scope

- No schema changes. No edge function changes. Early-access rows show no presence chip.
- No filter/sort by online status (can be added later if wanted).

## Question for you

Should offline real agents show a muted "Offline · 5m ago" indicator, or stay blank and only show the green pill when online? I'll default to **blank when offline, green pill when online** unless you say otherwise.
