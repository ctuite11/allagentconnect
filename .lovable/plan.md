Scope: only the two sections in the screenshots — the buyer recipient chip on `HotSheetReview` and the buyer header + hot sheet card on `HotSheetBuyerDetail`. No shared components touched.

### 1. `src/pages/HotSheetReview.tsx` — buyer recipient chip (screenshot 1)

Replace the `AgentAvatar` (which renders the AAC monogram fallback) with a local initials bubble that preserves the online green dot.

- Compute initials inline from `r.displayName` (first letter of first two words, uppercased).
- Render a `relative inline-flex` wrapper with:
  - A round `h-7 w-7 bg-violet-100 text-violet-700 text-[11px] font-semibold` bubble showing the initials.
  - If `r.authUserId` is present, query `useAgentLastSeen(r.authUserId)` and overlay the emerald presence dot (`absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white`) when online — same dot the `AgentAvatar` was rendering.
- Leave the `BuyerRowStatusPill` (Pending Invite / Searching) and surrounding chip layout untouched.

### 2. `src/pages/HotSheetBuyerDetail.tsx` — `RelationshipStatusPill` pending branch (screenshot 2, top card)

In the local `RelationshipStatusPill` (lines 113–128), the `pending` branch currently reads "Pending" with a sky-tinted pill. Update only that branch to:

- Text: `Pending Invite`.
- Style: match the smaller neutral pending pill used inside the hot sheet card (`border-neutral-200 bg-neutral-50 text-neutral-700`, clock icon `text-neutral-500`, same `rounded-full px-2.5 py-0.5 text-[11px] font-medium` shell).

The `active` branch ("Searching", blue) is unchanged.

### 3. `src/pages/HotSheetBuyerDetail.tsx` — hot sheet card footer icons (screenshot 2, bottom card)

Currently the footer Eye/"View" is `pointer-events-none` (relies on parent card click), Heart/"Favorites" is a real button. Make both explicit:

- Wrap the View item in a `<button type="button">` with `onClick={(e) => { e.stopPropagation(); navigate(`/hot-sheets/${hs.id}/review`); }}`, keeping the existing icon/label and AAC blue styling.
- Heart/Favorites already navigates to `/agent/buyers/${clientId}/favorites` — leave as-is.

Nothing else on the page or in shared components is modified.