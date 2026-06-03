# Add Contact button on Hot Sheet Review

## Goal
On `/hot-sheets/:id/review`, agents need a way to add another CRM contact as a recipient of the current hot sheet without leaving the page. Place the action next to the existing **Edit criteria** button.

## Scope (strict)
- Frontend-only change in `src/pages/HotSheetReview.tsx` + one new dialog component.
- No schema changes. No email/queue changes. No edits to the recipients pill strip styling.
- Hidden when `isSharedWorkspace` is true (buyer-side view). Hidden when `hotSheet` is null/loading.

## UX

1. New **Add contact** button (outline, `Pencil`→swap to `UserPlus` icon, matching the existing `Edit criteria` button styling) sits in the same row, immediately to the left of **Edit criteria**.
2. Clicking opens `AddHotSheetRecipientDialog`:
   - Lists agent's CRM contacts (`crm_clients` for current user) that are NOT already in `reviewRecipients`.
   - Searchable input (name/email).
   - Multi-select with checkboxes.
   - Primary button: **Add to hot sheet**. Disabled when no selection.
3. On submit:
   - Insert one row per selected contact into `hot_sheet_clients` (`hot_sheet_id`, `client_id`). Ignore conflicts via `upsert` on the existing unique constraint.
   - Toast success, close dialog.
   - Refresh `reviewRecipients` by re-running the existing recipient loader (extract the existing block at ~line 500–569 into a `loadRecipients()` callback, or simply re-trigger the main effect by bumping a `recipientsVersion` state). Lightweight approach: bump a local `recipientsVersion` state included in the main effect's dep array.
4. Empty state in the dialog: "All your contacts are already on this hot sheet." with a link to **/contacts** to add a new CRM contact.

## Technical notes

- Reuse existing CRM client fetch pattern from `src/components/CreateHotSheetDialog.tsx` (`crm_clients` select with `agent_id = auth.uid()`).
- Insert pattern (matches CreateHotSheetDialog line ~961):
  ```ts
  await supabase.from('hot_sheet_clients').upsert(
    selectedIds.map((cid) => ({ hot_sheet_id: id, client_id: cid })),
    { onConflict: 'hot_sheet_id,client_id', ignoreDuplicates: true },
  );
  ```
- No email is sent on attach — Send invites flow already exists in HotSheetReview and will pick up new recipients on next send.
- New component path: `src/components/hot-sheets/AddHotSheetRecipientDialog.tsx`.
- Button styling: copy classes from the existing `Edit criteria` button (line 1261–1269) verbatim to keep the row visually consistent (UI Freeze compliance — thin behavioral variant of the same shell).

## Files changed
- `src/pages/HotSheetReview.tsx` — add button + dialog mount + `recipientsVersion` state in main effect deps.
- `src/components/hot-sheets/AddHotSheetRecipientDialog.tsx` — new file.

## Out of scope
- Creating a brand-new CRM contact inline (link out to /contacts instead).
- Removing recipients (separate request).
- Any change to send/email logic.