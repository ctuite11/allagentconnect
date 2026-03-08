

## Plan: Remove Drafts Button Next to New Listing

**Change**: Remove the "Drafts" ghost button (lines 352–359) from the "New Listing Button Row" in `src/pages/MyListings.tsx`.

The `<div>` row will keep only the "New Listing" button. The Drafts filter remains accessible via the "draft" status in the pipeline filter pills below.

**File**: `src/pages/MyListings.tsx` (lines 343–360)

**Before**:
```tsx
<div className="mb-4 flex items-center gap-3">
  <Button ...>New Listing</Button>
  <Button variant="ghost" onClick={() => toggleStatus("draft")} ...>
    <FileText ... /> Drafts
  </Button>
</div>
```

**After**:
```tsx
<div className="mb-4 flex items-center gap-3">
  <Button ...>New Listing</Button>
</div>
```

One line group removed. No other files affected.

