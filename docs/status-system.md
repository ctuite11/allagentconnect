# Status System

> Single source of truth for all domain statuses in the AAC platform.

## Overview

The status system centralizes all status definitions, labels, colors, and logic in one place:

- **Constants**: `src/constants/status.ts`
- **Badges**: `src/components/ui/status-badge.tsx`

## Three Domains

| Domain     | Constant         | Badge Component       |
|------------|------------------|-----------------------|
| Listing    | `LISTING_STATUS` | `ListingStatusBadge`  |
| Agent      | `AGENT_STATUS`   | `AgentStatusBadge`    |
| Hot Sheet  | `HOT_SHEET_STATUS` | `HotSheetStatusBadge` |

## What's Allowed ✅

```tsx
// Import constants and badges
import { LISTING_STATUS, isComingSoon, isVerifiedAgent } from "@/constants/status";
import { ListingStatusBadge, AgentStatusBadge } from "@/components/ui/status-badge";

// Use constants for comparisons
if (isComingSoon(listing.status)) { ... }
if (listing.status === LISTING_STATUS.ACTIVE) { ... }

// Use badges for display
<ListingStatusBadge status={listing.status} />
<AgentStatusBadge status={agent.agent_status} />

// Use option arrays for selects/filters
import { LISTING_SEARCH_STATUSES } from "@/constants/status";
<Select options={LISTING_SEARCH_STATUSES} />
```

## What's Forbidden ❌

```tsx
// ❌ Hardcoded string comparisons
if (status === "coming_soon") { ... }  // Use LISTING_STATUS.COMING_SOON

// ❌ Manual label formatting
status.replace(/_/g, " ")  // Use getStatusLabel() or StatusBadge

// ❌ Inline status labels
<Badge>Coming Soon</Badge>  // Use <ListingStatusBadge status={status} />

// ❌ Local color maps
const statusColors = { active: "green", ... }  // Colors live in status.ts
```

## Adding a New Status

1. Add the value to the appropriate constant object (`LISTING_STATUS`, etc.)
2. Add the label to the corresponding `_LABELS` map
3. Add styling to the corresponding `_CONFIG` map
4. Add to relevant filter arrays if needed (e.g., `LISTING_SEARCH_STATUSES`)
5. If you need new branching logic, add a helper function (e.g., `isNewStatus()`)

## Helper Functions

### Type Guards
- `isListingStatus(status)` — Is this a valid ListingStatus?
- `isAgentStatus(status)` — Is this a valid AgentStatus?
- `isHotSheetStatus(status)` — Is this a valid HotSheetStatus?

### Listing Helpers
- `isComingSoon(status)` — Is "coming_soon"?
- `isActive(status)` — Is "active" or "new"?
- `isListingOnMarket(status)` — Active, new, back_on_market, or reactivated?
- `isUnderContract(status)` — Pending, under_agreement, or contingent?
- `isClosed(status)` — Sold or rented?
- `isListingInactive(status)` — Withdrawn, expired, or cancelled?
- `isDraft(status)` — Is draft?
- `isOffMarketStatus(status)` — Is considered "off market"?

### Agent Helpers
- `isVerifiedAgent(status)` — Is "verified"?
- `isPendingAgent(status)` — Is "pending"?
- `isAgentBlocked(status)` — Is "restricted" or "rejected"?

### Hot Sheet Helpers
- `isHotSheetActive(status)` — Is "active"?

### Label Lookups
- `getStatusLabel(status, domain)` — Get display label
- `getListingStatusLabel(status)` — Convenience for listings
- `getAgentStatusLabel(status)` — Convenience for agents
- `getHotSheetStatusLabel(status)` — Convenience for hot sheets

## ESLint Enforcement

Phase 6 ESLint rules in `eslint.config.js` warn on:
- Direct string comparisons like `=== "active"`
- Manual snake_case formatting via `replace(/_/g, ...)`

When warnings hit zero, flip `"warn"` → `"error"` for hard enforcement.

## Good Example

```tsx
import { isVerifiedAgent, isListingOnMarket, LISTING_STATUS } from "@/constants/status";
import { ListingStatusBadge, AgentStatusBadge } from "@/components/ui/status-badge";

function AgentCard({ agent, listings }) {
  const activeListings = listings.filter(l => isListingOnMarket(l.status));
  
  return (
    <div>
      <AgentStatusBadge status={agent.agent_status} />
      {isVerifiedAgent(agent.agent_status) && <VerifiedBadge />}
      
      <h3>{agent.name}</h3>
      <p>{activeListings.length} active listings</p>
      
      {activeListings.map(listing => (
        <div key={listing.id}>
          <ListingStatusBadge status={listing.status} size="sm" />
          {listing.address}
        </div>
      ))}
    </div>
  );
}
```
