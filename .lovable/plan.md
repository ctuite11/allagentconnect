

## Restore `BrowsePropertiesNew.tsx` from the previously sent local source

### Read of your message
You're confirming the local source bundle you already pasted is the correct, approved version. The job is to restore `src/pages/BrowsePropertiesNew.tsx` to that version exactly. No rebuild, no reinterpretation.

### Scope (locked, single file)
Edit only:
- `src/pages/BrowsePropertiesNew.tsx`

Untouched:
- `App.tsx`, `BuyerSearch.tsx`, `BuyerLayout`, `BuyerPortalHeader`
- `ListingCard`, `UnifiedPropertySearch`, `PropertyMap`, `buildListingsQuery`
- `ActiveAgentBanner`, `DcmlsConsumerHeader`
- routing, hooks, data layer, every other file

### Action
1. Pull the full local `BrowsePropertiesNew.tsx` source out of the earlier chunked paste in this thread (chat_search if needed to reassemble in order)
2. Overwrite `src/pages/BrowsePropertiesNew.tsx` verbatim with that content
3. No edits, no reformatting, no "improvements"

### Allowed integration adaptations (only if strictly required, flagged in report — not silent)
1. Supabase import normalized to `@/integrations/supabase/client` if the local path differs
2. `forceBuyer` prop signature preserved so `BuyerSearch.tsx` keeps rendering `<BrowsePropertiesNew forceBuyer />` unchanged

Anything beyond these two: stop and report before applying.

### Hard constraints
- No redesign, no rebuild, no new components, no new UX
- No styling not present in local source
- No Google Places ownership added inside this page
- No route changes
- No "while I'm here" cleanup
- No reconstruction from memory or screenshots — verbatim from the pasted chunks only

### If a referenced symbol in the pasted source can't be resolved
Stop and name the exact missing item (file + symbol + reason). Do not restart intake. Do not guess.

### Verification after overwrite
- Buyer toolbar matches local
- Inline pill filter bar matches local
- Manual search: 5-digit → `zipCode`, comma-separated → `towns`, empty → resets both, Enter applies
- No legacy header/banner blip on `/client/search`
- Route chain unchanged: `/client/search → BuyerSearch → <BrowsePropertiesNew forceBuyer />`
- TypeScript clean (fix only port-induced errors at the boundary, minimally)

### Deliverable
1. File replaced: `src/pages/BrowsePropertiesNew.tsx` only
2. Forced adaptations: exact lines + reason, or "none"
3. Confirmation route-safety files untouched
4. TypeScript validation summary

