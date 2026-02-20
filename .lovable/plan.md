

# Listing Attribution: Hide Listing Agent from Client Views

## Problem
Client-facing views currently leak listing agent identity ("Listed by Chris Tuite") in two components. The sticky agent system correctly tracks *who* the client's agent is, but the UI doesn't enforce it -- it still renders the per-listing agent name/company.

## Patch Targets (3 locations across 2 files)

| File | Lines | What it renders |
|------|-------|----------------|
| `ClientHotsheetPage.tsx` | 545-549 | `Listed by {agent.fullName} . {agent.company}` |
| `ListingCard.tsx` | 701-704 | `agentInfo.name . agentInfo.company` (compact/list view) |
| `ListingCard.tsx` | 1348-1365 | Agent avatar + `agentInfo.name` + `agentInfo.company` (grid view footer) |

## Implementation

### Step 1: Create `src/components/ListingAttribution.tsx`

A small shared component with this logic:

```
Props:
  - listingAgentName?: string
  - listingAgentCompany?: string

Internal logic:
  1. Get current user via supabase.auth.getUser()
  2. Get role via useUserRole(user)
  3. If role is "buyer" (client):
     a. Read sticky agent ID from getPrimaryAgentId()
     b. Fetch agent_profiles for that ID (first_name, last_name)
     c. Render: "Your agent {FirstName} {LastName}"
  4. If role is "agent" or "admin" (or no role / anonymous):
     - Render the standard attribution using the passed-in props
     - e.g. "Listed by {listingAgentName}" + company
```

### Step 2: Patch `ClientHotsheetPage.tsx` (lines 545-549)

Replace the hardcoded `Listed by {agent.fullName}` block with `<ListingAttribution>`.

Since `ClientHotsheetPage` is inherently a client view (accessed via share token), this component can simply **hide** the listing agent line entirely and show the sticky agent (already rendered in the agent header above). Alternatively, use the shared component for consistency.

### Step 3: Patch `ListingCard.tsx` (2 locations)

**Compact/list view (lines 701-704):** Replace `agentInfo.name` / `agentInfo.company` with `<ListingAttribution listingAgentName={agentInfo.name} listingAgentCompany={agentInfo.company} />`.

**Grid view footer (lines 1348-1365):** Same replacement -- wrap the avatar + name block with the shared component so clients see "Your agent {name}" and agents/admins see the existing listing agent info.

### Step 4: Add a `viewerRole` prop to `ListingCard` (optional optimization)

If the parent already knows the viewer role, pass it down to avoid redundant role-check RPCs inside each card. The component can accept an optional `viewerRole` prop and fall back to its own lookup if not provided.

## Role Detection Strategy

- Use the existing `useUserRole` hook (which calls `has_role` RPC)
- For unauthenticated users on client hotsheet pages (share-token access), treat as "client" by default since the page is client-only
- Cache the sticky agent name at the page level and pass it down to avoid N+1 fetches

## Acceptance Criteria

- Client (buyer role) sees **zero** listing agent names, companies, or contact info anywhere
- Client always sees "Your agent {StickyAgentName}" in attribution spots
- Agent and admin views remain completely unchanged
- No new database tables or migrations required
- Uses existing `getPrimaryAgentId()` utility and `useUserRole` hook

