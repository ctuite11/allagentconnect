

# Fix DCMLS Persistence, Duplicate Save Bar, and Visibility

## Investigation results

**DB state (59 total listings):**
- `publish_to_dcmls=true` AND `dcmls_status='published'`: **2 rows** (correctly visible)
- 1 row has `dcmls_status='draft'` with `publish_to_dcmls=false` (toggled off — but `'draft'` is not a recognized state in the filter convention `not_published | published | hidden | error`)
- 1 expired listing has `dcmls_status='published'` but `status='expired'` — filtered out (correct)

**Schema:**
- `dcmls_status` has NO check constraint, so any string is accepted (no DB-level rejection causing silent failures)
- RLS on UPDATE: `is_verified_agent() AND auth.uid() = agent_id` — works for the listing's owner

## Root causes

### 1. DCMLS toggle does not persist (AddListing/edit mode)

**Two different DCMLS payload helpers exist and conflict:**

- `src/lib/dcmlsPublishPayload.ts` → `dcmlsPublishSnapshot()` writes `dcmls_status: 'published' | 'draft'`
- `src/lib/dcmlsFilter.ts` → `buildDcmlsPayload()` writes `dcmls_status: 'published' | 'hidden' | 'error'` plus timestamps

`AddListing.tsx` (used for both add AND edit) uses `dcmlsPublishSnapshot` — writes `'draft'` when off. `EditListing.tsx` uses `buildDcmlsPayload` — writes `'hidden'`.

The form state is `formData.show_on_dcmls` (radio buttons) in `AddListing.tsx` and `publishToDcmls` (checkbox) in `EditListing.tsx`. **The state loads correctly on edit hydration in EditListing, but `AddListing.tsx` (which is also reached as the primary edit path) does NOT hydrate `show_on_dcmls` from the row** — confirmed by checking initial state (`show_on_dcmls: false`) with no setter from a load effect. So when a user edits in the AddListing edit-mode flow, the radio is reset to "No" on every page load, and saving overwrites the DB value back to `false / 'draft'`.

### 2. Duplicate sticky save bar

`AddListing.tsx` has both:
- Line 2955: `sticky top-0` action bar
- Line 4949: `sticky bottom-0` action bar (duplicate buttons — Preview + Save Changes/Draft + Publish)

Both bars call the same handlers, so functionally OK, but visually duplicated.

### 3. Visibility

The 2 properly-flagged listings DO satisfy the filter and will appear. Older listings the user thinks they "edited to publish" actually saved as `publish_to_dcmls=false / dcmls_status='draft'` because of root cause #1 (no hydration in AddListing edit mode → reverts on every save).

## Fixes

### Fix A — Single source of truth for DCMLS payload

Replace the simple `dcmlsPublishSnapshot` usage in `AddListing.tsx` with `buildDcmlsPayload` from `src/lib/dcmlsFilter.ts` (same one EditListing uses), so both pages write `'published' | 'hidden' | 'error'` consistently with timestamps.

Also normalize the existing 1 row currently sitting at `dcmls_status='draft'` to `'hidden'` via a small migration so it conforms.

### Fix B — Hydrate `show_on_dcmls` in AddListing edit-mode load

In `AddListing.tsx`, where the existing listing is fetched and state is populated for edit mode, add:
```ts
show_on_dcmls: data.publish_to_dcmls === true && data.dcmls_status === 'published'
```
Also load `dcmls_published_at`, `dcmls_status`, `dcmls_error` into refs/state for display + payload preservation.

### Fix C — Detect 0-row updates (no silent failures)

After `supabase.from('listings').update(...).eq('id', id)`, switch to `.select()` and check `data.length === 1`; if 0, surface a toast: "Update failed: no rows changed (likely permission or ID mismatch)."

Apply in both `AddListing.handleSaveChanges` and `EditListing` save handler.

### Fix D — Remove duplicate sticky bottom bar

In `AddListing.tsx`, delete the entire `sticky bottom-0` block (around lines 4948–5010). Keep the top sticky bar (line 2955) as the single action bar.

### Fix E — Add a CHECK constraint on `dcmls_status`

Migration to enforce allowed values (`not_published`, `published`, `hidden`, `error`) so future inconsistent writes (like `'draft'`) fail loudly instead of silently corrupting visibility.

## Files changed

| File | Change |
|------|--------|
| `src/pages/AddListing.tsx` | Use `buildDcmlsPayload`; hydrate `show_on_dcmls` + `dcmlsPublishedAt` in edit-load effect; add `.select()` + 0-row check; **remove bottom sticky bar (lines ~4948–5010)** |
| `src/pages/EditListing.tsx` | Add `.select()` + 0-row check on update |
| `src/lib/dcmlsPublishPayload.ts` | Delete (replaced by `buildDcmlsPayload`) and update any other importers |
| `supabase/migrations/<ts>_dcmls_status_normalize.sql` | `UPDATE listings SET dcmls_status='hidden' WHERE dcmls_status='draft'`; add `CHECK (dcmls_status IN ('not_published','published','hidden','error'))` |

## Returned answers (for the user)

1. **Persistence root cause**: AddListing edit-mode never hydrated `show_on_dcmls` from DB, so saving always wrote `false`. Two competing payload helpers also wrote conflicting values (`'draft'` vs `'hidden'`). **Fields written after fix**: `publish_to_dcmls`, `dcmls_status`, `dcmls_published_at`, `dcmls_last_updated_at`, `dcmls_error`.
2. **Duplicate save bar**: Removed bottom sticky block (~lines 4948–5010) in `src/pages/AddListing.tsx`. Top sticky bar remains; both used identical handlers so no functionality lost.
3. **Visibility counts**: 59 total listings, 2 currently visible on DCMLS. Older "published" attempts failed because of #1. Post-fix, toggling + saving will persist correctly and appear immediately on DCMLS.

