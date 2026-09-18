# Set Darcy Bento's listing to Coming Soon

## Goal
Change the status of Darcy Bento's listing at **141 West Sixth Street, Boston, MA** from `active` to `coming_soon`.

## Current state (confirmed)
- One listing exists for Darcy Bento (`darcy@bentorealestate.com`), created Sep 17.
- It is the only listing on her account and is currently `active`.
- `coming_soon` is a valid listing status in the centralized status system.

## Change (data only, no code, no migration)
Run one data update via the database query tool:

```sql
UPDATE listings
SET status = 'coming_soon'
WHERE id = '6e69dffe-9ec7-461a-ac1d-30a166609f3e';
```

Then re-read the row to confirm `status = 'coming_soon'`.

## Not changing
- No other listings, agents, or statuses.
- No schema, RLS, code, or email changes.
- No publish.

## Verification
- Query the listing before and after to show the status change.
- Confirm no other row was touched (the update is scoped by the listing's unique ID).
