## Goal

Bring back the visible agent count on `/our-agents` (Agent Network) that was previously hidden.

## Change

In `src/components/agent-directory/AgentDirectoryFilters.tsx`, replace the left-side placeholder area with a count display driven by the existing `resultCount` / `itemLabel` props (still passed from `OurAgents.tsx`):

- When there's a search query: `Results for "<query>" · N Agents`
- When there's no search query: `N Agents`
- While loading: keep the existing skeleton on the right; also show a small skeleton on the left in place of the count.

Singular/plural handled (`1 Agent` vs `N Agents`).

Sort dropdown, page-size dropdown, and all other behavior stay unchanged. No changes to `OurAgents.tsx` (it already passes `resultCount={totalCount}`).

## Out of scope

- Public `/our-agents` page for signed-out visitors uses the same component, so the count will also appear there. If you want it hidden for the public view only, say so and I'll gate it via a prop.
