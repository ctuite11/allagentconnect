
# Fix: Revert AddressAutocomplete to Last Known Working State

## What I found
- The current `src/components/AddressAutocomplete.tsx` is already a recently simplified rewrite, not the older multi-mode version described in the earlier plan file.
- The regression is isolated to the shared autocomplete component, which is used by:
  - `src/pages/AddListing.tsx`
  - `src/pages/AgentMatch.tsx`
  - `src/pages/AgentProfileEditor.tsx`
- The recent change likely removed one failure mode but introduced another: Google partially initializes, then the field freezes after input starts.

## Best fix direction
Do **not** guess at another patch first.

Instead, restore `src/components/AddressAutocomplete.tsx` to the **last known working implementation from the past few days**, then apply only the minimum compatibility cleanup needed so it still works with today’s callers.

## Scope
Modify only:
- `src/components/AddressAutocomplete.tsx`

Do not modify:
- `src/pages/AddListing.tsx`
- any other file unless the restored historical file absolutely requires a tiny import/type adjustment in the same component file

## Implementation plan
1. Use project History to identify the last version from the past few days where Google suggestions were confirmed working.
2. Restore only `src/components/AddressAutocomplete.tsx` from that working point.
3. Compare the restored file against the current callers and preserve these required behaviors:
   - field is always typeable
   - `onChange` still updates on manual typing
   - `onPlaceSelect` still returns the same place object shape expected by `AddListing`
   - preview key override still works
4. Keep or re-apply only the smallest safe protections if they were missing:
   - URL `?gmaps_key=` must win over stored/env key
   - the input must never be disabled
   - if Google fails, the field must remain a plain usable text input
5. Do not expand into the edit-flow issue yet.

## Why this is the safest path
- The user said this worked until the last few days.
- A historical restore is lower risk than inventing another new autocomplete architecture.
- The component is shared, so a targeted rollback of the single shared file is the cleanest way to recover known-good behavior.

## Verification required before calling it fixed
Test specifically in **Add Sale Listing**:
1. Type into Street Address → Google suggestions appear
2. Select a suggestion → address details continue populating correctly
3. Edit the field again after selection → fresh suggestions still appear
4. Bad/missing key → field remains typeable
5. Valid preview key via `?gmaps_key=` → suggestions recover correctly
6. Confirm no freeze after first character/number

## Technical notes
- There is also a docs/code mismatch on preview localStorage key naming (`aac_gmaps_key` in docs vs `gmaps_preview_key` in code). That is worth aligning only if the restored working version depends on it.
- Because `AddressAutocomplete` is shared, the restore should also be smoke-checked anywhere else it appears, but the primary acceptance target is Add Sale Listing.

## Acceptance criteria
- Add Sale Listing address field behaves exactly like the last known working version
- no freeze after one character/number
- Google suggestions return
- manual typing always works
- only `src/components/AddressAutocomplete.tsx` is changed
