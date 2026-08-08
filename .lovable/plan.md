# Buyer hot sheets page: the top card is not a hot sheet

## What you saw
On the Hot sheets page for buyer **greg gotti**, the white card at the top (initials, name, email, "Searching" pill, and the flame/matches/favorites/comments counters) is the **buyer summary card**, not a hot sheet. The message below it — "No hot sheets linked to this buyer" — is correct.

Confirmed in the database: this buyer has **zero** hot sheets linked (no `hot_sheet_clients` rows, no hot sheets assigned to the client). So nothing is missing from your Hot Sheets list.

## Why it reads as a hot sheet on mobile
The buyer summary card is styled like the hot sheet cards (same white rounded card, same counters row), and on a narrow screen it sits directly above the empty-state box, so it looks like a listed item.

## Proposed change (optional, UI only)
1. Add a small section label above the buyer card, e.g. "Buyer", so it is clearly identity/context rather than a hot sheet.
2. Add a "Hot sheets" section label directly above the list/empty state so the empty state clearly belongs to that section.
3. Keep the card visuals unchanged otherwise (no redesign, no logic change).

### Technical detail
- File: `src/pages/HotSheetBuyerDetail.tsx` — add the two section labels around `AgentBuyerActivityHeaderCard` and the hot sheet grid/empty state. No data, query, or component changes.
