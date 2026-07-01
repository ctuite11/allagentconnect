## Problem

On `/our-members` and `/our-agents`, the search bar misses agents whose names clearly exist in the network. Typing a valid last name returns 0 results — or only matches from the first page.

## Root Cause

In `src/pages/OurAgents.tsx`, `fetchData()` only loads the **current page's** full agent rows (24 by default). Search then filters that in-memory slice:

- Step 2a fetches `id, first_name, last_name, headshot_url` for all verified agents (used only for pagination + total count).
- Step 2b fetches full profile fields (`company`, `email`, `office_name`, `team_name`, `agent_county_preferences`, `agent_buyer_coverage_areas`) only for `pageAgentIds` — the current page.
- `filteredAgents` (line 349) runs `searchQuery` against `agents`, which is the enriched *page slice*.

Consequences:
1. Any agent not on the currently visible page is invisible to search.
2. State/county/incentive/has-listings filters have the same page-scoped bug.
3. Result count in the header shows the total network size, but the filtered grid can only ever match ≤ pageSize rows — reinforcing the "search is broken" feeling.

Search also does not tokenize: typing `"jane smith"` requires the substring to appear in a single field (`first_name` OR `last_name`), so full-name queries miss.

## Fix

Make the search + filters operate on the full verified network, and paginate the *filtered* result — not the raw feed.

1. **Load all visible verified agents once** (already partly done in step 2a). Extend that query to include the fields search/filters need:
   `id, aac_id, first_name, last_name, company, office_name, team_name, email, headshot_url, buyer_incentives, title, updated_at, phone, cell_phone, agent_county_preferences(county_id, counties(name,state)), agent_buyer_coverage_areas(city,state,county)`.
   Keep the existing `AGENT_NETWORK_DB_FILTERS` + `isVisibleInAgentNetwork` gating.

2. **Enrich once** (listing counts, service areas, specialties) for the full set. Listings query already fetches all agents' listings, so no extra cost per page.

3. **Filter across the full set** in `filteredAgents` (already correct shape) — but with two search improvements:
   - Build a lowercased `fullName = "${first} ${last}"` and match `query` against it, so "jane smith" works.
   - Split `query` on whitespace and require every token to match somewhere in the concatenated searchable string (`fullName + company + email + office + team + serviceAreas.join(" ")`). Handles "smith boston", "jane realty", etc.

4. **Paginate the filtered result client-side**: `paginatedAgents = filteredAgents.slice((page-1)*pageSize, page*pageSize)`. Render `paginatedAgents` in the grid; keep `totalCount = filteredAgents.length` for the header count and pager. Reset `page` to 1 when `searchQuery`/filters/`pageSize` change.

5. **Header count**: continue showing filtered total (this already reads `filteredAgents.length` via `resultCount`), but it will now correctly reflect matches across the whole network.

## Files

- `src/pages/OurAgents.tsx` — expand step 2a select, remove page-scoped step 2b, enrich full set, add token-based name search, paginate filtered result, reset page on filter/search change.

No DB, RLS, or backend changes. No UI redesign. Sort, page-size selector, presence, and intro overlays untouched.

## Verification

- Search a last name known to live on page 3 → appears immediately on page 1 of filtered results.
- Search "first last" (full name with space) → matches.
- Clear search → full network restored, pagination intact.
- State/county/incentive/listings filters return matches from anywhere in the network.
- Header count matches the number of cards rendered across all pages of the filtered result.
