

# Ticket 12: Expand Auto-Expiration to All Pipeline Statuses

## What Changes

One line change in the backend function `supabase/functions/update-listing-statuses/index.ts`.

### Current code (line 72)

```text
.eq('status', 'active')
```

This only expires `active` listings. Listings stuck in `new`, `coming_soon`, or `off_market` with a past `expiration_date` never get cleaned up.

### Replacement

```text
.in('status', ['active', 'new', 'coming_soon', 'off_market'])
```

This expands auto-expiration to all four pipeline statuses, matching the same set used by the My Listings filter.

## What Does NOT Change

- No database migrations
- No frontend changes
- No changes to the auto-activation logic (Part 1 of the function)
- No changes to the status history logging (already captures `oldStatus` dynamically)
- No changes to the cron schedule (Ticket 11)
- Terminal statuses (`sold`, `rented`, `withdrawn`, `cancelled`, `expired`, `draft`) are never touched

## Scope

- **1 file edited**: `supabase/functions/update-listing-statuses/index.ts`
- **1 line changed**: Line 72, `.eq(...)` becomes `.in(...)`
- The function will be redeployed automatically

