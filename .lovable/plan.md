## Goal

Approved Team profiles should appear as their own tiles in the Agent Network (`/our-agents`, `/our-members`, and public directory) — sitting alongside individual agent tiles, sharing the same search, filters, and sort behavior. Clicking a team tile opens `/team/:id`.

## Scope

Frontend-only presentation change in the directory pages. No schema changes. No changes to team creation/approval flow (already working).

## Changes

### 1. `src/pages/OurAgents.tsx` — fetch approved teams

In `fetchData()`, after the existing `agent_profiles` query, add a parallel fetch:

```
supabase.from("teams")
  .select("id, name, slug, logo_url, team_photo_url, company, office_name, contact_email, contact_phone, team_lead_user_id")
  .eq("status", "approved")
```

Map each team into an entry that plugs into the existing `EnrichedAgent` shape so the grid, search, sort, and pagination continue to work unchanged:

- `id` = team id, plus an `entity_type: "team"` discriminator
- `first_name` = team name, `last_name` = "" (so `matchesAgentName` and the last-name sort behave sensibly)
- `company` = team.company (falls back to `office_name`)
- `headshot_url` = `team_photo_url || logo_url`
- `email` / `phone` = team contact fields (respect the same authed-only gate used for agent contact PII)
- listing counts / service areas / specialties = 0 / empty for v1 (no team-level listing aggregation yet)

Merge teams + agents into a single array before the existing filter/sort/paginate pipeline.

### 2. Search + location filters

- Name/brokerage search: teams flow through `matchesAgentName` naturally because their name lives in `first_name`. Confirm the brokerage/email/phone matcher (`agentNetworkSearch.ts`) also matches on the team's mapped `company`.
- Location filter: v1 uses the team lead's coverage as a fallback — join `agent_county_preferences` / `agent_buyer_coverage_areas` by `team_lead_user_id` and attach them to the team entry so state/county/location filters include the team when the lead covers that area.
- "Listing agents only" and "Buyer incentives only" toggles: teams are excluded from these filtered views in v1 (no team-level listings or incentives yet).

### 3. Sort behavior

`featured` / `random` / recommended sorts: treat team tiles the same as agents that have a headshot (teams with `team_photo_url` or `logo_url` sort into the "has photo" tier; teams with neither sort into the initials tier using team-name initials).

### 4. `src/components/agent-directory/AgentPhotoTile.tsx` — team rendering

Add an optional `entityType?: "agent" | "team"` prop. When `"team"`:

- Render team name as the primary line, brokerage underneath (unchanged layout)
- Fallback avatar uses initials from the team name (via existing `initialsFromDisplayName`)
- Hide the "Online" presence dot (teams have no presence)
- Hide the AAC ID chip
- Click navigates to `/team/:id` instead of `/agent/:id`

Keep the same card chrome so the grid stays visually uniform.

### 5. `PublicOurAgents.tsx`

Same treatment — teams appear in the public directory too, with contact PII hidden for anonymous visitors (same rule already used for agents).

## Out of scope

- Team-level listing counts, incentives, or service areas beyond the lead's fallback
- Changes to team approval flow, team profile page, or team management
- Any backend/schema change
