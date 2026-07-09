## Goal

Split the single search on `/our-agents`, `/our-members`, `/agents`, `/find-agent` (all render `src/pages/OurAgents.tsx`) into two focused inputs:

1. **Name** — matches only `first_name` / `last_name`.
2. **Location** — Google Places autocomplete (city / state / town / neighborhood / region).

Visibility rules (`isVisibleInAgentNetwork`, verified filter, headshot gate) stay untouched.

## Changes

### 1. New name-only matcher — `src/lib/agentNameSearch.ts`
- Export `matchesAgentName(agent, query)`.
- Normalize query with existing `normalizeSearchText`.
- Split into tokens. Every token must be a prefix (or substring) of `first_name`, `last_name`, or the concatenated `"first last"`.
- Two-token queries also match when token1 → first_name AND token2 → last_name.
- Does NOT read company, office, email, phone, service areas, bio.

### 2. New location autocomplete — `src/components/agent-directory/LocationAutocomplete.tsx`
- Thin wrapper around existing `AddressAutocomplete` passing `types={["(regions)"]}` so Google returns cities, states, counties, neighborhoods (not street addresses).
- Parses `place.address_components` into `{ formatted, city, state, stateShort, county, neighborhood }`.
- Shows an "X" clear button; emits `null` on clear.

### 3. `src/pages/OurAgents.tsx`
- Replace the single search input block (around the current `Search` input, ~lines 447-462) with a two-input row:
  - **Name input** — placeholder `Search by first or last name`.
  - **Location input** — placeholder `Search city, state, or area`, powered by `LocationAutocomplete`.
- Add state: `selectedLocation: { formatted, city, state, stateShort, county } | null`.
- Update `filteredAgents` (~line 313):
  - Name filter → use new `matchesAgentName` (replaces `matchesAgentNetworkSearch` here only).
  - Location filter → if `selectedLocation` set, keep agent when ANY of its `serviceAreas` strings (already `"City, ST"` / `"County, ST"`) contains the selected `city` OR ends with `, ${stateShort}` / `, ${state}` OR matches selected `county`. Fall back to substring of `formatted` when no components resolved.
- Reset paging on `selectedLocation` change; include in `handleClearFilters`.
- Update the empty-state copy conditional to also consider `selectedLocation`.
- Leave the existing (currently unrendered) `selectedState` / `selectedCounties` state alone.

### 4. Out of scope
- `src/pages/AgentSearch.tsx` — not routed anywhere, untouched.
- No schema changes, no visibility rule changes, no changes to the filter/sort bar (`AgentDirectoryFilters`).

## Technical notes

- Google key already provisioned via `getGoogleMapsBrowserKey()` and used by `AddressAutocomplete`; no new secrets or connector work.
- `(regions)` autocomplete type covers city, state, county (admin_area_level_2), neighborhood, and postal town — matches the requested surface.
- Matching city against `serviceAreas` uses case-insensitive substring so `"Boston, MA"` matches `"Boston"`. State-only selections match every service area ending in that state.
- Name matcher is a pure function → unit-test friendly and cheap in the existing `useMemo`.

## Files touched
- add `src/lib/agentNameSearch.ts`
- add `src/components/agent-directory/LocationAutocomplete.tsx`
- edit `src/pages/OurAgents.tsx`
