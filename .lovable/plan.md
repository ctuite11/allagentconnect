

# Plan: Separate AAC Network from Personal Contacts

## Current State

- **No auto-insert trigger exists** — the previous plan to auto-create contacts on state signup was never implemented. Only 1 contact has `client_type = 'agent'` in the entire DB.
- **`clients` table** has no `source` or `agent_user_id` column.
- **Export** in `MyClients.tsx` exports all contacts without filtering.
- **Agent Network card** (`AgentMarketplaceCard.tsx`) has "Refer Client" and "Message" buttons but no "Save to Contacts".
- **Sidebar** already has both "Contacts" (`/my-clients`) and "Agent Network" (`/our-members`) as separate items.

## What Needs to Change

### 1. Database Migration — Add `source` and `agent_user_id` columns to `clients`

```sql
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS agent_user_id UUID NULL;
```

Backfill existing rows: all current contacts stay as `source = 'manual'` (the default).

### 2. Export Protection — `MyClients.tsx`

Update `handleExportCSV` to filter out network-sourced contacts:

```ts
const exportableClients = sortedClients.filter(c => c.source !== 'network');
```

Use `exportableClients` for CSV generation and show the filtered count in the success toast.

### 3. Add "Save to Contacts" Button — `AgentMarketplaceCard.tsx`

Add a third action button: **Save to Contacts** (with a `UserPlus` icon).

On click:
- Insert into `clients` with `source = 'network'`, `agent_user_id = agent.id`, `client_type = 'agent'`.
- Use `ON CONFLICT` or check-before-insert to prevent duplicates (match on `agent_id` + `email`).
- Show success/error toast.

### 4. Sidebar Label Reorder — `DashboardSidebar.tsx`

Reorder the `baseMainMenu` array to match the requested structure. Move "Agent Network" above "Contacts":

```
Success Hub
Search
Comms
Messages
Buyers
Agent Network    ← moved up
Contacts
Listings
HotSheets
Profile
```

### 5. Network Contact Badge — `MyClients.tsx`

For contacts where `source === 'network'`, show a small "AAC Member" badge next to their name in the contact list. This uses the existing `Badge` component.

## Files Modified

| File | Change |
|------|--------|
| **Database** | Add `source` and `agent_user_id` columns to `clients` |
| `src/components/agent-search/AgentMarketplaceCard.tsx` | Add "Save to Contacts" button |
| `src/pages/MyClients.tsx` | Filter export by source; show AAC Member badge |
| `src/components/agent-dashboard-v2/DashboardSidebar.tsx` | Reorder sidebar items |

## What Does NOT Change

- No new tables
- No RLS policy changes
- No messaging changes
- No layout redesigns
- No auto-insert triggers
- No changes to `Avatar`, `AgentAvatar`, or card styling

## Technical Details

- The `source` column uses a simple `TEXT` type with default `'manual'` — no enum needed since it's only checked in frontend export logic.
- `agent_user_id` links a contact back to the AAC agent's auth user ID, enabling profile linking in the future.
- The duplicate guard for "Save to Contacts" checks `agent_id` (the CRM owner) + `email` (the contact's email) before inserting.
- Import dialog (`ImportClientsDialog.tsx`) will automatically use `source = 'manual'` via the column default — no changes needed there.

