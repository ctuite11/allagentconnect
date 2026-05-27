Update the buyer dashboard email mock so the Hot Sheets section is populated instead of showing the empty state.

1. Edit `/tmp/buyers-mock.png` (the buyer dashboard screenshot) using imagegen edit to replace the empty Hot Sheets card ("No hot sheets yet. Create one from Hot Sheets for alerts, or ask your agent to share one.") with 2–3 mock hot sheet entries matching the same visual style as the Favorites section:
   - "Back Bay 2BR Condos" — Boston, MA · 4 new matches
   - "South End Brownstones" — Boston, MA · 2 new matches
   - "Seaport Lofts under $1.2M" — Boston, MA · 1 new match
   Keep everything else (logo, nav, profile card, stat cards, Favorites section, fonts, colors, spacing) byte-identical.
2. Re-upload the edited PNG to Supabase Storage at `email-attachments/early-access-v2/07-buyers.png`, overwriting the current image.
3. Bump `IMG_VERSION_V2` from `"v5"` → `"v6"` in `supabase/functions/send-bulk-email/index.ts` so email clients pull the new image.
4. No other changes.