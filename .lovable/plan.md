## Change

In `src/components/listing-search/ListingSearchFilters.tsx`, remove `"active"` (the "On MLS" status) from `initialFilters.statuses` so it is unchecked by default on the agent listing search (`/listing-search`).

Before:
```
statuses: ["new", "active", "price_changed", "back_on_market", "extended", "reactivated", "coming_soon", "off_market"],
```

After:
```
statuses: ["new", "price_changed", "back_on_market", "extended", "reactivated", "coming_soon", "off_market"],
```

## Behavior

- On a fresh visit to `/listing-search`, "On MLS" listings no longer auto-populate in results.
- Agents can still opt in by checking "On MLS" in the Status filter.
- Saved searches / URL params that already include `active` are respected (unchanged).
- No other search surfaces (buyer browse, hot sheets, DCMLS) are affected — this only touches the agent search initial filter defaults.