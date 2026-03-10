

## Fix: White background on sticky action bar

**File**: `src/components/listing-search/ListingResultsTable.tsx`

**Line 171** — the sticky action bar containing Select All, Keep Selected, Save Search, etc.

Change:
```
bg-[#FAFAF8]
```
to:
```
bg-white
```

No other changes.

