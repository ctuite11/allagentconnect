## Issue
On the Consumer Property Detail page (the only surface using `PropertyFactsRow`), all five icons (Bed, Bath, Sq Ft, $/sf, DOM) now render in neutral-600 ("black/gray") instead of AAC blue.

## Root cause
`src/pages/ConsumerPropertyDetail.tsx` passes `iconClassName="!text-neutral-600"` to `PropertyFactsRow`. The `!important` prefix forces neutral-600 and overrides the AAC blue set inside `PropertyFactsRow`, so all icons render gray.

## Fix (one-line change, single file)
Remove the `iconClassName="!text-neutral-600"` prop from the `PropertyFactsRow` usage in `src/pages/ConsumerPropertyDetail.tsx` (line 701). With that prop gone, every icon (Bed, Bath, Sq Ft, $/sf, DOM) inherits AAC blue (`#0E56F5`) from `PropertyFactsRow`.

## Out of scope
- No changes to `PropertyFactsRow.tsx` or `propertyTokens.ts`.
- No other callers, no styling tweaks, no layout changes.
