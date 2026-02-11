

# Reverse Prospecting: Dual Count (Agents + Prospective Buyers)

## Concept

The badge and dialog will show two numbers:

> **10 agents, 50 prospective buyers**

- **Agents**: Unique `user_id` values from matching `hot_sheets`
- **Prospective buyers**: Unique clients from `hot_sheet_clients` linked to those matching hot sheets. For hot sheets with no linked clients (consumer-created), the hot sheet itself counts as 1 prospective buyer.

## Data Model

```text
hot_sheets
  - user_id (agent or consumer who created it)
  - criteria (matching filters)

hot_sheet_clients (join table)
  - hot_sheet_id --> hot_sheets.id
  - client_id   --> clients.id

clients
  - agent_id, first_name, last_name, email
```

A hot sheet created by an agent may have 1-N clients via `hot_sheet_clients`. A hot sheet created by a consumer typically has zero `hot_sheet_clients` entries -- in that case, the consumer themselves is the prospective buyer.

## Changes

### 1. `src/components/ListingCard.tsx` -- Dual counts on badge

- Add `user_id` to the hot_sheets select query
- After filtering matching sheets, compute:
  - `agentCount = new Set(matchingSheets.map(s => s.user_id)).size`
  - Fetch `hot_sheet_clients` for matching sheet IDs to get total unique `client_id` values
  - For sheets with no clients in `hot_sheet_clients`, count the sheet itself as 1 buyer
  - `buyerCount = uniqueClients + sheetsWithNoClients`
- Store both counts in state
- Badge displays: "X agents, Y buyers" (or just "Y buyers" if only 1 agent)

### 2. `src/components/ReverseProspectDialog.tsx` -- Full rewrite

**Data loading:**
- Query matching `hot_sheets` (same filter logic as ListingCard)
- Join `hot_sheet_clients` and `clients` to get buyer names per sheet
- Group by agent (`user_id`), look up agent info from `agent_profiles`

**Display:**
- Header: "Your listing matches X agents and Y prospective buyers"
- Cards grouped by agent, each showing:
  - Agent name and email
  - List of matching client names under that agent
- For consumer hot sheets (no agent profile), show "Direct buyer" with the hot sheet name

**Send logic:**
- One email per agent
- Each email lists all their matching client names
- For consumer hot sheets, email goes to the consumer (looked up via `profiles` table using `user_id`)

### 3. `supabase/functions/send-reverse-prospecting/index.ts` -- Consolidated email

- Accept `matchingClientNames: string[]` per recipient
- Add a "Matching Clients" section to the email:
  > This property matches criteria for:
  > - Johnson Family Search
  > - Smith Buyer
  > - Downtown Condo Hunt

## Badge Examples

| Scenario | Badge Text |
|----------|-----------|
| 3 agents, 12 clients total | "3 agents, 12 buyers" |
| 1 agent, 5 clients | "1 agent, 5 buyers" |
| 0 agents, 2 consumer hot sheets | "2 buyers" |
| 2 agents + 1 consumer, 8 clients total | "3 agents, 9 buyers" |

## Files Changed

| File | Change |
|------|--------|
| `src/components/ListingCard.tsx` | Dual count logic, updated badge display |
| `src/components/ReverseProspectDialog.tsx` | Replace `client_needs` with grouped `hot_sheets` + `hot_sheet_clients` logic |
| `supabase/functions/send-reverse-prospecting/index.ts` | Add matching client names to email template |

## No Database Changes Required

All needed tables (`hot_sheets`, `hot_sheet_clients`, `clients`, `agent_profiles`) already exist.

