

## Fix: Listing Agent + Buyer Interest Signals — Same Row

### File: `src/components/ListingCard.tsx` (lines 713-727)

The attribution and interest signals are currently on separate rows. The screenshot shows them **inline on the same row**: listing agent on the left, buyer signals on the right (or continuing inline).

**Change**: Wrap both `ListingAttribution` and `ListingInterestSignals` in a single `flex items-center justify-between` row:

```jsx
<div className="flex items-center justify-between mt-1 gap-2">
  {agentInfo && (
    <ListingAttribution
      listingAgentName={agentInfo.name}
      listingAgentCompany={agentInfo.company}
    />
  )}
  {interestSignals && (
    <ListingInterestSignals
      savesCount={interestSignals.saves_count}
      commentsCount={interestSignals.comments_count}
      hotsheetMatchCount={interestSignals.hotsheet_match_count}
    />
  )}
</div>
```

Remove the separate wrapping `<div className="text-right mt-1">` around attribution and the standalone `ListingInterestSignals` block. Both go into one flex row. The `mt-2` on `ListingInterestSignals` component itself should also be removed (change to `mt-0` or remove the outer margin since the parent now handles spacing).

