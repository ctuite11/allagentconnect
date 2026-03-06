

## Restore Draft Delete Controls in My Listings

### Problem
Line 465 has `{/* Draft bulk-select removed — drafts filtered out server-side */}` — all handlers (`toggleDraftSelection`, `selectAllDrafts`, `handleBulkDelete`) and state (`selectedDraftIds`, `showBulkDeleteConfirm`) exist but have zero UI rendering them. Grid view also lacks any individual delete control.

### File: `src/pages/MyListings.tsx`

**1. Replace the removed comment (line 465) with bulk-action toolbar**

Only visible when the draft status filter is active and draft listings exist in the current results:

```text
┌──────────────────────────────────────────────────┐
│ ☑ Select All (2 of 5)        [Delete Selected]   │
└──────────────────────────────────────────────────┘
```

Condition: `selectedStatuses.has("draft") && draftListings.length > 0`

Wires into existing `selectAllDrafts()` and `setShowBulkDeleteConfirm(true)`.

**2. Add per-draft checkbox in list view (line ~573, inside each CardSurface)**

For listings where `l.status === "draft"`, render a Checkbox on the left of the card content that calls `toggleDraftSelection(l.id)`. Non-draft rows get no checkbox.

**3. Add per-draft checkbox in grid view (line ~473, inside each grid CardSurface)**

Same treatment: overlay a small checkbox in the top-left corner of draft cards only, wired to `toggleDraftSelection(l.id)`.

**4. Add delete action to grid view draft cards**

For draft cards only, add a 3-dot `MoreHorizontal` menu (matching the list view pattern at lines 652-667) with a "Delete Listing" item that calls `setListingToDelete(l)`. Position it at the top-right of the card image area.

**5. Verify list view 3-dot menu visibility**

The existing menu at `absolute top-4 right-4` (line 640) should be confirmed visible. Will add `z-10` if needed to prevent clipping by adjacent elements.

### No other files need changes
All delete handlers, confirmation dialogs, and bulk delete logic already exist and are functional.

