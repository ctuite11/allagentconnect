

# Listing Card Badge: Show Buyer Count Only, Rename "Client" to "Buyer"

## What Changes

On the listing card in My Listings, the match badge currently shows a dual label like "3 agents, 12 buyers". It should show **only the buyer count** as a single number, e.g. "12 Buyer Matches" or "1 Buyer Match".

The Reverse Prospect dialog remains unchanged -- it keeps its dual agent + buyer display.

## File: `src/components/ListingCard.tsx`

### Update `getMatchLabel()` (lines 544-554)

Remove the agent count from the label. Show only buyer count with the word "Buyer":

- `0 Buyer Matches` when buyerCount is 0
- `1 Buyer Match` when buyerCount is 1  
- `N Buyer Matches` when buyerCount > 1

Current code builds a parts array with agents + buyers. New code simply returns:
```
`${buyerCount} Buyer Match${buyerCount !== 1 ? 'es' : ''}`
```

### No other changes

- `loadMatchCount()` stays the same (still computes both `agentCount` and `buyerCount` -- needed by the dialog)
- `getMatchButtonStyle()` stays the same (already uses `buyerCount` for color thresholds)
- `ReverseProspectDialog` stays the same (keeps its dual agent/buyer display)
- Edge function stays the same

## Single file changed

| File | Change |
|------|--------|
| `src/components/ListingCard.tsx` | Simplify `getMatchLabel()` to show only buyer count with "Buyer Match(es)" label |
