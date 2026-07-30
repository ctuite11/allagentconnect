## Investigation result (confirmed by reading the code)

Opening an existing listing always shows "Unsaved changes" — reproduced signed-in at `/agent/listings/edit/:id?ref=stale-reminder&confirm=1`.

**Cause — `src/pages/AddListing.tsx` lines 500-508:**

```ts
// Track form changes
useEffect(() => {
  if (!user) return;
  const hasContent = formData.address || formData.city || formData.price ||
                     formData.bedrooms || formData.description;
  if (hasContent) setHasUnsavedChanges(true);
}, [formData, user]);
```

This effect treats *any* non-empty form content as a user edit — it never compares against what was loaded. In edit mode the sequence is:

1. `loadExistingListing()` runs many `setFormData(...)` hydration calls and ends with `setHasUnsavedChanges(false)` (line 960).
2. Those updates are batched, so the reset and the hydration land in the same commit.
3. After commit, the tracking effect runs with the now-populated `formData`, sees `hasContent`, and immediately sets dirty back to `true`.

Secondary contributors that re-fire the same effect after hydration (normalization counted as edits):
- The state/county cascade effect (lines ~470-488) can clear `formData.city` when the city list is filtered/reloaded.
- Numeric/array/date normalization during hydration (`String(parking_spaces)`, `lead_paint` string→array, price/date formatting) writes values that differ in shape from the DB row.

**Knock-on effects:** the 14-second debounced autosave (lines 510-526) is armed on load, and the `beforeunload` warning (lines 528-538) fires on navigation even with no edits.

`src/pages/AddRentalListing.tsx` has the identical pattern (lines 164-167, reset at 549).

## Fix plan

1. **Add a hydration baseline** in `AddListing.tsx`: a `baselineRef` holding a canonical snapshot of the form state, plus a `hydratedRef` flag.
2. **Snapshot after hydration settles**, not mid-batch — set the baseline in an effect that runs once `isLoadingListing` flips false (and for the new-listing path, once initial defaults are set). Until the baseline exists, the tracking effect is a no-op, so hydration writes can never mark the form dirty.
3. **Replace the `hasContent` heuristic with a comparison.** Dirty = canonical snapshot of current state differs from baseline. Canonicalization normalizes the known noise: `null`/`undefined` → `""`, numbers → trimmed strings, dates → `YYYY-MM-DD`, arrays sorted and empty-filtered, so null→empty-string and re-ordering are not edits.
4. **Include the non-`formData` collections** already watched by autosave (photos, floor plans, documents, disclosures, features, amenities) in the same baseline so the check is consistent with what autosave saves.
5. **Reset the baseline on save** — after `handleSaveDraft` / `handleSaveChanges` succeed (lines ~2519, ~2797), re-snapshot instead of only setting the flag false, so post-save state is the new clean point.
6. **Mirror the same change in `AddRentalListing.tsx`** (lines 164-167 / 549).

## Verification

Signed-in via Playwright on the real listing:
- Open the edit URL → no "Unsaved changes" badge, no autosave fires within ~20s.
- Type in one field → badge appears.
- Revert the field → badge clears (comparison-based, not one-way).
- Save → badge clears and stays clear.
- Navigate away untouched → no `beforeunload` prompt.

## Out of scope

No changes to PR #31 assistant work, no migration, no function deploys. If the PR #31 files (`team_scoped_account_assistants` migration, `AssistantSection`) appear in the workspace during this work, I stop and report the sync status before touching them.
