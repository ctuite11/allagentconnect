## Mobile My Listings card — action row revision

Update the mobile visibility rules in the card action row in `src/pages/MyListings.tsx`.

### Mobile (< sm) — kept
- Edit
- Photos
- **Open House**
- **Broker Tour**
- Email / Social / Stats — keep current behavior (hidden on mobile, still in "⋯ More")

### Mobile — hidden (visible on sm+)
- Matches (n)
- 👁 views
- ♥ favorites
- Their neighboring `•` separators

### Files
- `src/pages/MyListings.tsx` — flip responsive classes only. Open House and Broker Tour items (and their separators) lose `hidden sm:inline`. Matches, views, hearts (and their separators) gain `hidden sm:inline-flex` / `hidden sm:inline`. No logic, no other files.

### Verification
At 384px: header row shows Edit • Photos • Open House • Broker Tour + status pill. Matches/views/hearts hidden. At ≥640px: unchanged from today.
