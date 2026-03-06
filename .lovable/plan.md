

## Fix: Swap ListingAttribution and ListingInterestSignals sides

### File: `src/components/ListingCard.tsx` (around line 713)

The current flex row has attribution on the left and interest signals on the right. User wants it reversed: **interest signals on the left, listing agent attribution on the right**.

Simply swap the order of the two children inside the existing `flex items-center justify-between` div:

```jsx
<div className="flex items-center justify-between mt-1 gap-2">
  {interestSignals && (
    <ListingInterestSignals ... />
  )}
  {agentInfo && (
    <ListingAttribution ... />
  )}
</div>
```

No other changes.

