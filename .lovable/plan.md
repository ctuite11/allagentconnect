## Problem
On `/our-members` (and `/our-agents`), the count in the filter bar ("N agents found") only reflects the current page's paginated slice, not the total across all pages. There is also no way to change how many agents show per page.

## Changes

### 1. `src/pages/OurAgents.tsx`
- Pass the true total (`totalCount` from the network-visibility query, not `filteredAgents.length`) into `AgentDirectoryFilters` so the header reads e.g. "312 agents found" regardless of current page.
- Add a `pageSize` state (default 24) with options: **24, 48, 96, All**.
- Replace the hard-coded `PAGE_SIZE` constant with the stateful `pageSize` in `fetchData` (`from/to` calculation) and in the pagination footer math.
- When `pageSize === "All"`, fetch the full visible list in one page (skip the `.slice` window) and hide the Prev/Next controls.
- Reset `page` to 1 whenever `pageSize` changes.
- Keep client-side filters (search, state, county, buyer incentives, listing agents) working on the current page's data — no change to filter logic.

### 2. `src/components/agent-directory/AgentDirectoryFilters.tsx`
- Add optional `pageSize` and `onPageSizeChange` props.
- Render a small "Show per page" `Select` (24 / 48 / 96 / All) next to the existing sort dropdown, matching the existing minimalist style.
- Loading skeleton row gets a second skeleton chip so layout doesn't jump.

### 3. Pagination footer (in `OurAgents.tsx`)
- Show controls only when `pageSize !== "All"` and `totalCount > pageSize`.
- Label updates to `Page X of Y · N total`.

## Out of scope
- No changes to visibility rules, RPC, RLS, or agent enrichment logic.
- No redesign of tiles, filters layout, or brand tokens.
- `AgentSearch.tsx` / `IDXSearch.tsx` are untouched — the complaint is about the Agent Network.
