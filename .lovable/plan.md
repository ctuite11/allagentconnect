

# Ticket 15 / 15A / 15B: DOM Rules, Clone Listing, Back on Market, and Property History

## Status: ✅ Complete

All items implemented:

### 15A — Back on Market + DOM Continuity
- `AGING_RESET_DAYS = 30` constant in `src/constants/status.ts`
- `back_on_market` in edit-mode dropdown (`ADD_LISTING_EDIT_STATUSES`)
- `back_on_market` in pipeline filter set (`PIPELINE_STATUSES` in MyListings)
- Status badges, labels, pipeline visibility all configured

### 15B Part 1 — Clone Listing
- "Clone as New Listing" button on AgentListingDetail (own expired/cancelled only)
- Clone reception in AddListing via `location.state.clonedListing`
- `is_relisting` / `original_listing_id` metadata in insert payload

### 15B Part 2 — Property History Panel (Cross-Agent)
- Edge function `get-property-history` (authenticated, service-role bypass)
  - `verify_jwt = true` — only authenticated users can call
  - Priority matching: attom_id first, then normalized address/city/state
  - Address normalization: lowercase, strip punctuation, normalize suffixes
  - Bounded results: max 10 listings, 20 status events, 10 price changes per listing
  - Whitelisted fields only (no broker remarks, contacts, lockbox, etc.)
  - Agent display name + office name from agent_profiles join
- `PropertyHistoryPanel` component in `src/components/PropertyHistoryPanel.tsx`
  - Collapsible card, lazy-loads on first open
  - Loading skeleton, error state, empty state
  - Timeline: status changes, price changes, agent info, dates
- Integrated into AgentListingDetail (agent view only, after detail cards)

---

## DOM Rules Summary

| Scenario | What happens | DOM |
|----------|-------------|-----|
| Back on Market (within 30 days) | Same row, status change | Continues |
| Reactivate (within 30 days) | Same row, status → active | Continues |
| Reactivate (after 30 days) | Same row, cumulative_active_days reset | Resets |
| Clone listing | New row, is_relisting: true | Starts at 0 |
