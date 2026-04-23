

## Restore `src/pages/BrowsePropertiesNew.tsx` from already-provided local source

### State of intake
The local source bundle was already delivered in chunks 1–12 in this thread. Intake is complete. Not restarting it.

What is in context from the prior bundle:
- Full `src/pages/BrowsePropertiesNew.tsx` local source
- `src/components/search/UnifiedPropertySearch.tsx`
- `buildListingsQuery` helper
- `PropertyMap`
- `ActiveAgentBanner` (buyer shell banner)
- Supporting imports referenced inline

This is sufficient to perform the restore. No additional paste required.

### Scope (locked, single file)
Edit only:
- `src/pages/BrowsePropertiesNew.tsx`

Do not touch:
- `App.tsx`, `BuyerSearch.tsx`, `BuyerLayout`, `BuyerPortalHeader`
- `ListingCard`, `UnifiedPropertySearch`, `PropertyMap`, `buildListingsQuery`, `ActiveAgentBanner`, `DcmlsConsumerHeader`
- routing, hooks, data layer, any other file

### Action
Overwrite `src/pages/BrowsePropertiesNew.tsx` verbatim with the local source already provided in the prior chunks.

### Allowed integration adaptations (only if strictly required, flagged in report)
1. Supabase import normalized to `@/integrations/supabase/client` if local path differs
2. `forceBuyer` prop signature preserved so `BuyerSearch.tsx` route contract keeps working unchanged

Any other deviation will be surfaced before applying — not silently changed.

### Hard constraints
- No redesign, no rebuild, no new components, no new UX
- No styling changes not present in local source
- No Google Places ownership added
- No route changes
- No "while I'm here" cleanup
- No reconstruction from memory or screenshots — verbatim from the pasted local source only

### Verification after overwrite
- Buyer toolbar present as in local
- Inline pill filter bar present as in local
- Manual search logic: 5-digit → `zipCode`, comma-separated → `towns`, empty → resets both, Enter applies
- No legacy header/banner blip on `/client/search`
- Route chain unchanged: `/client/search → BuyerSearch → <BrowsePropertiesNew forceBuyer />`
- TypeScript clean (fix only port-induced errors at the boundary, minimally)

### Deliverable
1. Files replaced: `src/pages/BrowsePropertiesNew.tsx` only
2. Forced adaptations: exact lines + reason, or "none"
3. Confirmation route-safety files untouched
4. TypeScript validation summary

### If anything specific is missing
If during the overwrite a specific symbol referenced by the pasted local source is not resolvable from the prior chunks, I will stop and name the exact missing item (file name + symbol + reason) — not restart intake.

