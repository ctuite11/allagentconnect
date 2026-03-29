

# Fix: Remove `updated_at` from Success Hub query

## Change

**File:** `src/hooks/useSuccessHubData.ts`

1. Remove `updated_at` from `.select()` string
2. Change `.order("updated_at", ...)` to `.order("created_at", ...)`

Two-line fix. No other files affected.

