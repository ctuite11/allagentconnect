# 12G Lovejoy Wharf (L-1454): why agent search doesn't show it (read-only diagnosis, revised)

## Product rule (binding)
- **Off Market is a published status.** Verified agents can search it.
- Only Drafts are left out of search and matching.
- Signed-out visitors and unverified users stay blocked.
- There is no "Private" status, filter or label.

Nothing was changed, sent or published. I only read 12G's row and the Hot Sheets it matched.

## 12G facts (only what's needed)
- Off Market, for sale, condo, Boston (Suffolk), 02114.
- Published Nov 7, 01:36 UTC (Nov 6, 8:36 PM ET), straight from Draft.
- **List date:** Oct 28, carried over from the draft.
- **Created:** Oct 28.
- **Neighborhood:** blank.
- **Price:** single price is 0; price range is $1.299M–$1.325M.
- Has photos and map coordinates.

## Confirmed by the data
- **Access rules allow it.** Any signed-in user can read listings with a published status, Off Market included. Drafts are readable only by the owner's own account.
- **Unfiltered agent search includes it.** The agent search defaults (`ListingSearchFilters.tsx:93-96`) are:
  - for sale
  - single family or condo
  - statuses including Off Market
- 38 published listings meet those defaults, and 12G is one of them.
- **The 500-result cap is not involved**, since only 38 rows match.
- So with no extra criteria, 12G should appear.

## Not yet confirmed: which filter excluded it
I don't have the exact live search that was run. These are the only conditions in the code (`src/pages/ListingSearchResults.tsx:186-300`) that could exclude 12G:

| Search criterion | Exact condition | Effect on 12G |
|---|---|---|
| Boston neighborhood picked | `buildLocationFilter.ts:50-51` requires an exact neighborhood match | Excluded, because its neighborhood is blank |
| Price per sq ft min or max | `filterByPricePerSqft` uses the single price | Likely excluded, because price 0 gives $0/sq ft (still to verify in code) |
| List-date "from" after Oct 28 | `ListingSearchResults.tsx:242` checks `list_date` | Excluded, because it uses the draft's date, not publish day |
| Price min/max | `applyListingPriceOverlapFilter.ts` | Included if the range overlaps |
| Radius search | finds listings within the radius by map location | Included if Lovejoy is inside the radius |
| Street, ZIP, keywords | text matching | Excluded only by a mismatch |
| Results opened before 8:36 PM and not re-run | — | Not shown until the search is re-run |

Hot Sheet matching runs on the server (`process-hot-sheet/index.ts` ~430-460). The matched Hot Sheets use whole-city "Boston" or no city, no neighborhood, and no price-per-sq-ft or list-date conditions. That's why they matched 12G when a narrower agent search may not.

Public `/search` (`SearchResults.tsx:160-165`) is a separate page for signed-out visitors and isn't part of this diagnosis.

## Step to confirm (read-only)
1. Get the exact search link or a screenshot of the filters.
2. Sign in as Chris in a test browser, open that exact search, and remove one criterion at a time until 12G appears. That pinpoints the excluding condition. No saves, Hot Sheets or emails.

## Narrow fix options (decided only after step 2, built in the migration environment)
- **Neighborhood:** when a neighborhood is picked, also include same-city listings with a blank neighborhood and a ZIP code in that neighborhood. This applies to agent search only.
- **Price per sq ft:** when the single price is 0, use the price-range midpoint (or skip the check) instead of $0.
- **List date:** when a Draft is first published, set or show list date as the publish date. This is a publishing-rule change and needs separate approval.

## Regression tests
- **Signed out:** 12G and other Off Market listings never appear on public pages or through direct links.
- **Unverified user:** blocked from agent search.
- **Verified agent (not the owner):** 12G appears with default filters, with Boston only, and with the criterion that failed before.
- **Listing owner:** sees 12G.
- **Drafts:** all three Lovejoy drafts stay hidden from search and matching.
- **Other Off Market listings:** results are unchanged.
- **No messages:** no Hot Sheet, notification or email jobs are created during testing.
