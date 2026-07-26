## Standardize user-facing listing status filters

Single-file edit in `src/constants/status.ts`. Remove `LISTING_STATUS.NEW` from every user-selectable filter option array and ensure `LISTING_STATUS.OFF_MARKET` is present. Keep existing label style and relative ordering in each array.

### Arrays updated

1. **`LISTING_SEARCH_STATUSES`** (line 301) — drop `NEW` row (line 302). `OFF_MARKET` already present.
2. **`HOT_SHEET_FILTER_STATUSES`** (line 336) — drop `NEW` row (line 337). Add `OFF_MARKET` entry (label `Off Market`, no MLSPIN code — it's an AAC-only status) placed after `BACK_ON_MARKET` to match `LISTING_SEARCH_STATUSES` ordering.
3. **`AGENT_SEARCH_STATUSES`** (line 356) — drop `NEW` row (line 357). Add `OFF_MARKET` entry after `BACK_ON_MARKET`.
4. **`CONSUMER_SEARCH_STATUSES`** (line 374) — drop `NEW` row (line 375). Add `OFF_MARKET` after `BACK_ON_MARKET`.
5. **`DEFAULT_SEARCH_STATUSES`** (line 385) — drop `LISTING_STATUS.NEW` (line 386). This is what UnifiedPropertySearch resets to; keeping `COMING_SOON`, `ACTIVE`, `BACK_ON_MARKET` as sensible defaults. Do not add `OFF_MARKET` here (defaults represent on-market listings; users can opt in via the filter).

### Explicitly not changed

- `LISTING_STATUS.NEW` enum value, labels (`LISTING_STATUS_LABELS`), MLSPIN mapping, badge config — historical records still render correctly.
- `MLSPIN_FILTER_STATUSES` — already lacks `NEW` and has `OFF_MARKET`. No change.
- `DASHBOARD_FILTER_STATUSES` (agent's own dashboard tabs) — internal pipeline view, not a user-facing market filter. Left as-is; user's spec targets search/filter/hot-sheet listing filters.
- `ADD_LISTING_CREATE_STATUSES` / `ADD_LISTING_EDIT_STATUSES` — agent's own status picker for their listing, not a filter. Already correct (no `NEW`, has `OFF_MARKET`).
- `AGENT_LISTINGS_TAB_STATUSES` — agent pipeline tabs, not a listing status filter.
- Business logic in `useListingBanners.ts`, `AddListing.tsx`, `EditListing.tsx`, `status.ts` helpers (`isActive`, `isListingOnMarket`) — these read/write the `new` DB value and are out of scope per spec.
- No database migration. `hotSheetCriteriaCore.ts` `DEFAULT_HOT_SHEET_STATUSES` already excludes `new` and includes `off_market`. Saved criteria that still contain `"new"` will load; the UI's status option list simply won't render an option for it, and the value will drop out on the next save. Query filters against `listings.status` still accept `"new"` transparently.

### Acceptance verification

After the edit I'll re-run `grep -rn "LISTING_STATUS.NEW" src/` and confirm no remaining hits are user-selectable filter entries (only enum/labels/config maps and read-side business logic).

### Files changed

- `src/constants/status.ts` (one file).