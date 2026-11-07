# 12G Lovejoy Wharf: why the Hot Sheet matched but search didn't show it (read-only diagnosis)

Nothing was changed, sent or published. I only read this listing's row and the Hot Sheets it matched. I didn't look at any other agent's private records.

## Listing facts (only what's needed)
- L-1454, Boston (Suffolk), 02114, condo, for sale, published as Private tonight around 8:36 PM ET.
- **Neighborhood is blank.**
- Single price is 0, so it uses a price range of $1.299M–$1.325M.
- List date is Oct 28 (taken from the draft).
- It has photos and map coordinates.

## Data-access check
- The listings table allows any signed-in user to read published statuses, Private included. Drafts are readable only by the owner's own account.
- So 12G can be read by signed-in agents. Draft rows stay hidden.

## Agent search (`/listing-results`, agents only)
- Code: `src/pages/ListingSearchResults.tsx` lines 167–300.
- The private-listing filter there (`src/lib/filterVisibleListings.ts`) does nothing. It's not the cause.
- The default statuses include Private (`ListingSearchFilters.tsx:95`).
- The price filter handles price ranges correctly (`applyListingPriceOverlapFilter.ts`).
- With default filters plus Boston, Condo or a $1.2–1.4M price, 12G passes every condition.
- **It drops out in these situations:**
  1. **A Boston neighborhood was picked** (for example "Boston-West End"). Picking a neighborhood requires an exact neighborhood match (`src/lib/buildLocationFilter.ts:50-51`). 12G's neighborhood is blank, so it fails. Hot Sheet matching on plain "Boston" still includes it.
  2. **"Private" was unticked**, or the search came from a saved or old link with its own statuses.
  3. **A list-date range starting after Oct 28.**
  4. **The search tab was opened before 8:36 PM** and not re-run.

## Public search (`/search`)
- `src/pages/SearchResults.tsx:160-165` removes every Private listing unless the viewer is the listing agent.
- Signed-out visitors and other agents correctly never see it. **This filter must stay.**
- If you were on `/search`, that rule is the reason, and it's working as intended.

## Hot Sheet matching
- Matching runs in a server function that can read all listings (`supabase/functions/process-hot-sheet/index.ts` ~430–460). It is not limited by each viewer's access rules.
- The Hot Sheets that matched list Private explicitly and match on whole cities ("Boston") or no city at all, with no neighborhood.
- So matching follows different rules from search. That explains the mismatch whenever cause 1 or the public page applies.

## Root cause (to confirm)
The data and access rules allow 12G in agent search. The gap must come from the search's own filters or from which page was used. **Most likely cause: a Boston neighborhood filter combined with 12G's blank neighborhood.** I can't see your saved search filters without asking, so this isn't confirmed.

## Narrowest privacy-safe fix (only if cause 1 is confirmed, needs approval)
- **Option A (no code):** add the correct neighborhood to 12G. This is a listing edit, so it needs the agent's or your approval.
- **Option B (code, agent search only):** when a neighborhood is picked, also include listings in that city with a blank neighborhood but a matching ZIP code. This touches only `buildLocationFilter.ts` and the agent search, never public `/search`.
- Leave the public `/search` Private filter as it is.

## Test plan (read-only, nothing sent)
1. Re-run your exact agent search, signed in as you, and record which filter excludes 12G.
2. **Signed out:** `/search` and `/property/<id>` must not show 12G.
3. **Unverified agent:** `/listing-results` is blocked by the agents-only gate, and 12G isn't shown.
4. **Verified agent (not the owner):** `/listing-results` shows 12G with default filters, with Boston only, and with Boston plus a neighborhood (after Option B).
5. **Listing owner:** sees 12G on both pages.
6. **Drafts:** the three Lovejoy drafts never appear for anyone except the owner's own account.
7. Confirm no Hot Sheet, notification or email jobs are created during testing.

## What I need from you
Which page and filters did you use? A screenshot of the search filters is enough.
