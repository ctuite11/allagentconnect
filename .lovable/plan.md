

# Move Metadata Block Up to Action-Button Row

## What Changes

The right-side metadata block (Status badge, Listed date, Exp date, DOM, overflow menu) stays exactly as designed -- just moves from the content row up to the action-button row, so the status badge is visually in line with Edit / Photos / Open House buttons.

## Technical Detail (all in `src/pages/MyListings.tsx`)

### 1. Change the action row container (lines 568-628)

Currently the action row is:
```
<div className="mb-3">
  <div className="flex items-center gap-2 ...">
    Edit . Photos . Open House ...
  </div>
</div>
```

Wrap to `flex justify-between items-start` so actions go left and metadata goes right:
```
<div className="mb-3 flex justify-between items-start">
  <div className="flex items-center gap-2 ...">
    Edit . Photos . Open House ...
  </div>
  <!-- metadata block moved here, unchanged -->
</div>
```

### 2. Move the metadata block (lines 797-820) into the action row

Cut the entire right-side metadata `div` (StatusBadge, Listed, Exp, DOM, overflow menu) from line 797-820 and paste it inside the new `flex justify-between` container, after the action buttons div. The metadata markup stays identical -- same classes, same content, no design changes.

### 3. Remove empty space from content row

After moving the metadata block out, the content row (line 631) will only contain the photo and center text stack. No other changes to the content row.

| File | Changes |
|------|---------|
| `src/pages/MyListings.tsx` | Move metadata div from content row into action-button row container; wrap action row in `flex justify-between items-start` |

No design changes to the metadata block itself. No other files changed.
