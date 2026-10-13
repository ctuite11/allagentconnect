# Save Draft for Create Hot Sheet (Personal and Buyer)

## How it works today
- Create Hot Sheet is one large dialog. Nothing is saved until the final Create click, so leaving the dialog loses everything.
- Each Hot Sheet record already has an "active" on/off switch. The matching check only looks at sheets that are switched on, so a sheet that is off never matches listings and never sends anything.
- An "off" sheet is not the same as a draft. Agents can already pause sheets, so drafts need their own label.

## What agents will see
- **Save Draft button** in Create Hot Sheet, available at any point. It needs no name, contact, buyer or criteria.
- **Automatic saving** about 2 seconds after the first real change (typing a name, choosing Personal/Buyer, picking an area or criteria, or adding a contact). Just opening the dialog creates nothing. A small "Draft saved" note confirms each save.
- **My Hot Sheets** shows drafts in their own "Drafts" group with a Draft badge, plus **Continue Editing**, **Rename** and **Delete**. Drafts never appear among active sheets or in match counts.
- **Continue Editing** reopens Create Hot Sheet with everything restored: name, type, criteria, areas, price, property types, chosen contacts and selected listings. It keeps updating the same draft, so no duplicate is created. Drafts are stored on the server, so they survive refreshes, logging out and switching devices.
- **Finishing a draft:** the existing Create button runs the usual checks and then turns the same record into a real Hot Sheet.
  - Personal: no contact needed.
  - Buyer: same flow as today, ending on Review with the pinning, count and saved selections working as they do now.

## Safety
- A draft is always switched off and labeled Draft, so matching, notifications, batches and invitations never see it.
- On the server:
  - A draft can't have a saved first batch or invitation.
  - The invite and processing steps refuse drafts.
- Contacts picked in a draft are kept with the draft only. They are linked when the sheet is created, so a draft never shows up in a buyer's or contact's views.
- Existing Hot Sheets are not touched. Every current sheet keeps its current state.
- Communications Center, Hot Sheet email rules and buyer relationships are unchanged. No emails, invitations or test notifications.

## Testing (no sending)
- Automated tests:
  - Drafts are excluded from matching and active lists.
  - Resuming updates the same record.
  - Opening the dialog doesn't create a draft.
  - The server refuses to batch or invite a draft.
- Signed-in preview check of save, leave, resume and finish for a Personal draft. For Buyer, the check stops at Review without clicking Send.
- Before and after counts for the email queue and active Hot Sheets.

## Technical details
- Migration (additive):
  - `hot_sheets.is_draft boolean NOT NULL DEFAULT false`
  - `hot_sheets.draft_state jsonb` holding pending contact IDs, selected listing IDs and the UI step
  - A trigger keeps `is_active = false` while `is_draft` is true, and rejects `hot_sheet_recipient_batches` / `hot_sheet_clients` inserts for draft sheets.
  - Partial index on `(user_id) WHERE is_draft`.
- Matching already filters on `is_active` (for example `hot_sheet_criteria_matches`, `count_matching_agents`, `get_hot_sheet_for_member`, `list_hot_sheets_for_member`). The trigger keeps drafts inactive, so no matcher change is needed. Each one will be checked during the build.
- `process-hot-sheet` and `send-hot-sheet-invite` add an `is_draft` refusal next to the existing Personal refusal.
- Draft autosave and single-record creation in `CreateHotSheetDialog.tsx` reuse the single-flight pattern from `addListingDraftSession.ts`: one create, then updates, with no overlapping saves. Finishing does an update (`is_draft=false`, `is_active=true`, set `sheet_type`) and then the existing contact linking and batch flow.
- `HotSheets.tsx`: add a Drafts section, and filter `is_draft` out of active lists and counts.
- AGENTS.md: drafts are `is_draft` rows that are never active and never linked to recipients until finished.
