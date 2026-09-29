# Listing-page copy quality fix (global)

## 1. Keep state abbreviations uppercase everywhere
- Shared `buildDisplayAddress()` in `src/lib/utils.ts` title-cases the whole address, which turns `MA` into `Ma`. It is used in 6 app files (details, cards, etc.).
- Fix it once in the shared formatter. After title-casing, put the state code back in uppercase: first the listing's own `state` value after a comma, then a general safety rule for any `, Xx 12345` ending. The email helper already uses this same approach.
- `listingCardStreetHeading()` and `formatListingConversationTitle()` build on this formatter, so they get the fix automatically.
- No changes to saved listing data. Everything else about the address stays as it is: unit `#`, street abbreviations, title case on the street.

## 2. Fix Vincent Rizzo's title where it's stored
- Vincent's saved agent profile (AAC-0639) has the title `Real Estate Advisot`. Change it to `Real Estate Advisor`, updating only that one field on that one profile.
- No Vincent-specific replacement in the app code.

## 3. Quick QA
- On the 4 Derne St listing, check that the address reads **4 Derne St #1, Boston, MA 02114** and the agent card reads **Vincent Rizzo / Real Estate Advisor**.
- Spot-check 1–2 other listings (details page and a card) to confirm state codes stay uppercase and nothing else in the address changed.

No redesign, no other data changes.
