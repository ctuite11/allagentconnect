

## Fix Hot Sheet Review Page — 3 Changes

### File: `src/pages/HotSheetReview.tsx`

**1. Header** — Replace stacked uppercase layout with inline format:
```jsx
<h1 className="text-xl font-semibold">
  <span className="text-neutral-800">Hotsheet Name: </span>
  <span style={{ color: '#0E56F5' }}>{hotSheet.name}</span>
</h1>
```

**2. Controls row** — Flatten to one row, remove "Remove Selected":
- Delete `handleRemoveSelected` function
- Delete the separate bulk action bar div
- Inline "N Selected" + "Keep Selected" into the Select All row (left side)
- Rename CTA from "Invite Clients" to "Send First Batch"

### File: `src/components/ListingCard.tsx`

**3. Listing agent attribution** — Move to its own bottom-right row (grid view)

Currently (lines 714-719), the `ListingAttribution` is **inside** the beds/baths/sqft row (`flex items-center justify-between`). The screenshots show it belongs on its **own separate row below** the stats, right-aligned.

Change: Move the `{agentInfo && ...}` block **out** of the stats div (line 698-720) and place it **after** that div as its own `<div className="text-right mt-1">` block, so attribution sits in the bottom-right corner of the card on its own line — matching the screenshot exactly.

