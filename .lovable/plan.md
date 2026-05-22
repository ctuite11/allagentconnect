# Plan: Wire the buyer's heart on Hot Sheet results to `hot_sheet_favorites`

## Audit result (root cause)

On the buyer's Hot Sheet results page (`src/pages/ClientHotsheetPage.tsx`), the heart **does render** — for `role === "buyer"`, `suppressFavoriteHeartChrome` is false so `<FavoriteButton />` is mounted on each card (lines ~899–906 in `ListingCard.tsx`).

The problem is what that heart writes to:

- `FavoriteButton` (`src/components/FavoriteButton.tsx`) only reads/writes the generic **`favorites`** table (`{ user_id, listing_id }`).
- The agent's Hot Sheet Review reads only from **`hot_sheet_favorites`** (`{ hot_sheet_id, listing_id, user_id }`).

So when a buyer hearts a listing on their Hot Sheet results page, it lands in `favorites` — invisible to the agent's Hot Sheet Review and to any per–hot-sheet view. That's why "hearts appear on the Favorites cards" (the buyer's own Favorites page reads `favorites`) but nothing surfaces in the hot-sheet context for the agent.

`ClientHotsheetPage` already passes `hotSheetId={hotSheet?.id}` to `ListingCard`, but `ListingCard` never forwards it to `FavoriteButton`, and `FavoriteButton` has no hot-sheet write path.

## Fix

Single behavior change: when `FavoriteButton` is mounted inside a hot-sheet context, **also** insert/delete a matching row in `hot_sheet_favorites` alongside the existing `favorites` write. No new UI, no role gating changes, no schema changes.

### Files

1. **`src/components/FavoriteButton.tsx`**
   - Add optional `hotSheetId?: string` prop.
   - On initial load: if `hotSheetId`, also OR-check `hot_sheet_favorites` for `(user_id, listing_id, hot_sheet_id)` when computing initial filled state (so the heart shows filled if the row exists in either table).
   - On toggle ON: keep the existing `favorites` insert; additionally upsert into `hot_sheet_favorites` `{ user_id, listing_id, hot_sheet_id }` (ignore duplicate-key conflict).
   - On toggle OFF: keep the existing `favorites` delete; additionally delete the matching `hot_sheet_favorites` row.
   - All hot-sheet writes are guarded by `if (hotSheetId)`; behavior elsewhere is unchanged.

2. **`src/components/ListingCard.tsx`**
   - In the `showInteractiveFavoriteButton` branch (≈ line 899), forward the existing `hotSheetId` prop to `<FavoriteButton hotSheetId={hotSheetId} … />`.

3. **No change** to `ClientHotsheetPage.tsx` — it already passes `hotSheetId` to `ListingCard`.

4. **No change** to `HotSheetReview.tsx` — its read of `hot_sheet_favorites` already drives the agent's read-only heart and will start lighting up immediately once buyers favorite from the hot-sheet page.

5. **RLS check (read-only verification — no migration unless needed):** confirm `hot_sheet_favorites` already allows the authenticated buyer (recipient) to `insert` / `delete` their own rows scoped to `hot_sheet_id`s they have access to. If a policy is missing we'll add a minimal one in a follow-up migration — flagged here so it's not a surprise, but not pre-emptively written since the table is already in active use elsewhere (`ClientHotSheet.tsx` writes to it today).

## What stays the same
- `ListingCard` role gating (`suppressFavoriteHeartChrome` for agents/admins) — unchanged.
- The buyer's `/favorites` page continues to work off the `favorites` table, so anything hearted on a hot sheet still also shows there.
- Agent's Hot Sheet Review continues to render hearts only when a `hot_sheet_favorites` row exists — but now those rows will actually get created.

## Expected outcome
Buyer opens the Hot Sheet results page → hearts a listing → row written to both `favorites` and `hot_sheet_favorites`. Agent opens Hot Sheet Review → sees the red filled heart on that listing card immediately.
