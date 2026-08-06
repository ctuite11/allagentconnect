# Close the last zero-price listing gap

## What the audit found

The pricing rule is already in place and working. The database constraint
`listings_non_draft_requires_pricing_check` requires, for any listing that is not a draft:

- For Sale: a price greater than 0, or both ends of a price range greater than 0
- For Rent: a monthly rent greater than 0

50 Proctor Ave (L-1232) is the single legacy row that predates that rule. It was created
2026-07-20 17:20 UTC and last edited 17:52 UTC; the rule went live later that evening. It was
never blocked because the constraint was intentionally added as "not validated" so the deploy
would not fail on pre-existing rows.

Current state of zero-price rows:

```text
L-1232  off_market  for_sale   price 0   <- 50 Proctor Ave (legacy, pre-rule)
L-1273  draft       for_sale   price 0   <- draft, allowed
L-1284  draft       for_sale   price 0   <- draft, allowed
```

No new listing can be published or moved off-draft without a price today.

## Proposed work

1. Set the real price on 50 Proctor Ave. I need the correct list price from you, or you can
   open the listing and enter it yourself in the edit form.
2. Once no non-draft row has a zero price, mark the existing constraint as validated so the
   rule is enforced retroactively and no legacy row can slip through again.

Nothing else changes: no Hot Sheets, Communications Center, email, cron, or RLS changes.

## Technical notes

- Step 1 is a single data update on `public.listings` for `be535bee-...` (or a manual edit in the UI).
- Step 2 is a one-line migration: `ALTER TABLE public.listings VALIDATE CONSTRAINT listings_non_draft_requires_pricing_check;`
  It takes a brief lock only for the scan and makes no schema change.
- Drafts remain exempt by design so agents can save work in progress.
