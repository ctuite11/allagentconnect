# Agent Network: find teams by name

## Audit findings (verified)

- The Agent Network / Find an Agent directory is `src/pages/OurAgents.tsx` (routes `/our-agents`, `/our-members`). It loads eligible agent ids via the `get_verified_agent_ids` RPC, then reads `agent_profiles`, and separately reads approved rows from `teams`.
- Teams already exist as a real model and already appear in the directory as tiles: approved teams are mapped into the same card shape with `entity_type: "team"` and link to `/team/<slug>` (the existing Team Profile page). No new team system is needed.
- Team name is stored in two places: the canonical `teams.name` (4 approved teams today), and a free-text `agent_profiles.team_name` on agent records (70 agents filled in). Membership lives in `team_members` (accepted rows).
- The search box today is name-only: it uses `matchesAgentName` (first/last name only) and explicitly excludes team tiles from results. So typing "Tuite Group" returns nothing even though the team tile exists.
- Reading approved teams and accepted members is already permitted by existing policies. No schema change and no permission change is required.

## What will change

1. Search box matches more than agent names
   - Placeholder becomes `Search agents, teams, brokerages...`
   - A query matches an agent when it matches their name, their brokerage/company, or their team name.
   - A query matches a team tile when it matches the team name or the team's brokerage.
   - Location search stays in its own separate box, unchanged.

2. New All | Agents | Teams filter
   - Placed next to the search bar, default **All**.
   - All: agents and teams together (current behaviour plus team-name matches).
   - Agents: agent tiles only.
   - Teams: approved team tiles only.
   - Changing the filter resets to page 1; result count and the "Agents" label update to reflect what's being shown.

3. Make a team match visible
   - When an agent tile is surfaced because of a team-name match and the card is currently showing a brokerage instead, the card shows the team name so it's obvious why the agent matched.

Everything else — sorting, page size, pagination, location/state/county filters, incentives and listing filters, cards, profiles, contact flows — stays exactly as it is.

## Technical notes

- New matcher module (e.g. `src/lib/agentDirectorySearch.ts`) built on the existing `normalizeSearchText` helpers: token-based match across name, `company`/`office_name`, and team name; team entities match on `name` + company. `matchesAgentName` stays in place for any other caller.
- Attach canonical team names to agents by reading accepted `team_members` rows for the approved teams already being fetched, and fall back to `agent_profiles.team_name` when there is no membership row. One extra lightweight query in the existing parallel fetch.
- `entityFilter` state (`all` | `agents` | `teams`) added in `OurAgents.tsx`, applied inside the existing `filteredAgents` memo before the other filters, and added to the page-reset effect dependencies.
- Filter control rendered as a small segmented control next to the search inputs; `AgentDirectoryFilters` receives an `itemLabel` matching the active mode.
- No migration, no RPC change, no RLS change, no writes to agent or team records, no emails.

## Verification before review

- Search "Tuite Group" style team names: the team tile appears, and its members appear under All.
- Search an agent name: unchanged results.
- Teams filter: only the 4 approved teams show; Agents filter excludes them.
- Count, pagination and sorting stay correct across each mode.

Stop after verification; no publish.
