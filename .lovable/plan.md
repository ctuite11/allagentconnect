

# Plan: Agent Count Bar with Pending-Only Default

## Overview
Add a horizontal status count bar to the Admin Approvals page (`/admin/approvals`) that displays counts for all agent statuses, while limiting the main agent list to only show **Pending** agents by default.

---

## Current State
- The page shows all agents regardless of status
- Status filtering is via a dropdown (line 653-665)
- Status distribution data is already available from the edge function response
- Agent statuses defined in `src/constants/status.ts`: `unverified`, `pending`, `verified`, `restricted`, `rejected`

---

## Implementation

### 1. Status Count Bar Component
Add a horizontal bar of clickable pills showing counts for each status, positioned between the filters bar and the agent list.

**UI Design:**
```text
┌───────────────────────────────────────────────────────────────────────────┐
│  Pending (12)  │  All (47)  │  Verified (30)  │  Rejected (3)  │  ...    │
└───────────────────────────────────────────────────────────────────────────┘
```

- Use the existing `Pill` component from `src/components/ui/pill.tsx`
- Highlight the active filter with `active` prop
- Each pill is clickable to filter by that status
- Colors match the status badge colors from `AGENT_STATUS_CONFIG`

### 2. Default Filter Behavior
- Change the default `statusFilter` state from `"all"` to `"pending"`
- This ensures the approvals queue shows only agents awaiting review

### 3. Filter Logic Update
Update the `filteredAgents` useMemo to handle the filter:

```typescript
// Status filter - "pending" is the default
if (statusFilter !== "all") {
  result = result.filter((a) => a.agent_status === statusFilter);
}
```

### 4. Count Calculation
Create a computed object for status counts:

```typescript
const statusCounts = useMemo(() => {
  const counts: Record<string, number> = { all: agents.length };
  agents.forEach((a) => {
    counts[a.agent_status] = (counts[a.agent_status] || 0) + 1;
  });
  return counts;
}, [agents]);
```

---

## Technical Details

### File Changes

| File | Change |
|------|--------|
| `src/pages/AdminApprovals.tsx` | Add status count bar, change default filter to "pending", add count calculation |

### Status Pills Order
1. **Pending** (amber) - default selected, first position
2. **All** (neutral)
3. **Verified** (emerald)
4. **Unverified** (neutral)
5. **Rejected** (rose)
6. **Restricted** (rose)

### Pill Variant Mapping
```typescript
const variantForStatus = (status: string): PillVariant => {
  switch (status) {
    case "pending": return "warning";
    case "verified": return "success";
    case "rejected":
    case "restricted": return "danger";
    default: return "neutral";
  }
};
```

---

## UI Placement
The count bar will be inserted after the search/filter bar (around line 693) and before the agent cards:

```tsx
{/* Status Count Bar */}
<div className="flex flex-wrap gap-2 mb-6">
  <Pill
    label={`Pending (${statusCounts.pending || 0})`}
    variant="warning"
    active={statusFilter === "pending"}
    onClick={() => setStatusFilter("pending")}
  />
  <Pill
    label={`All (${statusCounts.all})`}
    variant="neutral"
    active={statusFilter === "all"}
    onClick={() => setStatusFilter("all")}
  />
  <Pill
    label={`Verified (${statusCounts.verified || 0})`}
    variant="success"
    active={statusFilter === "verified"}
    onClick={() => setStatusFilter("verified")}
  />
  <Pill
    label={`Unverified (${statusCounts.unverified || 0})`}
    variant="neutral"
    active={statusFilter === "unverified"}
    onClick={() => setStatusFilter("unverified")}
  />
  <Pill
    label={`Rejected (${statusCounts.rejected || 0})`}
    variant="danger"
    active={statusFilter === "rejected"}
    onClick={() => setStatusFilter("rejected")}
  />
  <Pill
    label={`Restricted (${statusCounts.restricted || 0})`}
    variant="danger"
    active={statusFilter === "restricted"}
    onClick={() => setStatusFilter("restricted")}
  />
</div>
```

---

## Summary
- Adds a visual status count bar for quick filtering
- Defaults to showing only **Pending** agents (the approval queue)
- Maintains ability to view all agents or filter by any specific status
- Uses existing Pill component and AGENT_STATUS constants for consistency
- Pending pill is positioned first and highlighted by default

