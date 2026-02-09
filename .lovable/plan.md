

# Ticket 13: Draft Aging (Stale Badge) + Cleanup Nudges

## What Changes

**1 file edited**: `src/pages/DraftListings.tsx`

No database migrations. No backend changes. No new components needed. All logic is client-side using `updated_at` from the existing query.

---

## Implementation Details

### 1. Replace static "Updated" dates with relative time

Replace the current `formatDate(l.updated_at)` calls with `formatDistanceToNow` from `date-fns` (already used across the codebase in 6+ files).

- Grid view: `Updated 3 weeks ago` (replaces `Updated 1/15/2026`)
- List view: `Updated: 3 weeks ago` (replaces `Updated: 1/15/2026`)

The existing `formatDate` helper can be removed since it's only used in this file.

### 2. Add aging badge helper

A small helper function inside `DraftListings.tsx`:

```text
function getDraftAgeBadge(updatedAt: string) --> { label, className } | null
```

Logic:
- 90+ days since `updated_at`: returns `{ label: "Old Draft", className: "bg-red-50 text-red-700" }`
- 30-89 days since `updated_at`: returns `{ label: "Stale Draft", className: "bg-yellow-50 text-yellow-700" }`
- Under 30 days: returns `null` (no badge)

Uses `differenceInDays` from `date-fns`.

### 3. Render aging badge next to existing status badges

In both grid and list views, after the `ListingStatusBadge` and listing type badge, conditionally render the aging badge:

```text
Draft  |  For Sale  |  Stale Draft
```

Uses the same inline `<span>` pattern already used for the listing type badge (text-[10px], font-medium, px-1.5, py-0.5, rounded).

### 4. Add "Stale Only" filter toggle

New state: `filterStale` (boolean, default `false`).

A toggle button placed in the action row between the "New Listing" button and the view toggle:

```text
[New Listing]    [All Drafts | Stale Only]    [Grid|List]
```

Uses the same inline button group style as the existing Grid/List toggle (border, rounded-lg, p-0.5, bg-white). Two segments:
- "All" -- shows all drafts
- "Stale" -- filters to only drafts where `updated_at` is 30+ days old

Filtering is done client-side with `useMemo` over the `listings` array. The filtered list is used for rendering instead of the raw `listings` array.

### 5. Old drafts cleanup banner (Phase 2, included)

If the agent has any drafts older than 90 days, show a small info banner between the action row and the listing cards:

```text
You have N drafts older than 90 days. Consider deleting the ones you don't need.  [Show Old Drafts]
```

- Light amber background (`bg-amber-50 border border-amber-200 rounded-lg p-3`)
- "Show Old Drafts" button switches the filter to "Stale Only"
- Dismissible per session (state-based, not persisted)

---

## What Does NOT Change

- No database migrations
- No auto-delete behavior
- No status changes to any listing
- No backend/edge function changes
- No changes to other pages
- No new npm dependencies (uses existing `date-fns`)
- No changes to the status system in `constants/status.ts`

---

## Technical Summary

| Area | Detail |
|------|--------|
| File | `src/pages/DraftListings.tsx` |
| New imports | `formatDistanceToNow`, `differenceInDays` from `date-fns` |
| New state | `filterStale: boolean`, `bannerDismissed: boolean` |
| New helpers | `getDraftAgeBadge(updatedAt)` |
| Removed | `formatDate()` helper (replaced by `formatDistanceToNow`) |
| New UI elements | Aging badges, stale filter toggle, old drafts banner |
| Filtering | Client-side `useMemo` over existing `listings` state |

