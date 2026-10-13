# Save Draft for Create Hot Sheet (Personal and Buyer), revised with your safeguards

Everything you approved in principle stays the same: the Save Draft button, autosave, Continue Editing / Rename / Delete, server-side storage, finishing through the existing checks, and no change to active sheets, buyer relationships or Communications Center. This revision adds your four safeguards, puts Drafts first, and fixes two problems the investigation found.

## What the investigation found
- **Creating a Hot Sheet is not all-or-nothing today.** The app saves the sheet as active first and links the buyer contacts second. If linking fails, an active sheet is left behind with no contacts.
- **Draft fields would break existing rules if saved as-is.** The database requires every Hot Sheet to have a name and criteria, so a draft with an empty name would be refused unless handled.
- **Every Hot Sheet save also writes a "buyer need" record behind the scenes.** That's an automatic copy of the area and price into Communications Center buyer needs. Today this happens on every create or edit that has a state. A draft must never do this, or a half-finished draft would show up as a buyer need.
- **Turning a sheet on doesn't send anything by itself.** But once a sheet is active, any new listing that matches can produce alerts. So an active sheet created during testing is a real risk, even if no email goes out at that moment.

## Safeguard 1: Atomic completion
- Finishing a draft becomes one server step: it either all succeeds or nothing changes.
- In that single step the server:
  1. checks the draft still belongs to the agent and is still a draft;
  2. re-runs the required checks (name, type, criteria, and at least one contact for Buyer);
  3. links the buyer contacts;
  4. only then turns the sheet on and clears the Draft label.
- If any part fails (for example, a contact was deleted, or a duplicate-email rule blocks it), the whole step is undone. The draft stays a draft, stays off, and keeps all its contacts and selections. The agent sees a plain error message.
- Running the same finish twice (a double click or a retry) is safe. The second attempt sees the sheet is no longer a draft and makes no changes.
- New sheets created without a draft go through the same single step, so the existing half-saved problem is fixed too. Buyer sheets still go straight to Review as they do now.

## Safeguard 2: Unsaved changes
- **"Draft saved" appears only after the server confirms the save.** While a save is in progress it says "Saving…". If a save fails it says "Not saved – retry", and the change stays marked as unsaved.
- **Closing the dialog** with unsaved changes (via X, Cancel, Escape or clicking outside) first tries one immediate save. If that doesn't succeed, it asks: "You have unsaved changes. Save as draft / Discard / Keep editing."
- **Leaving the page** (switching screens in the app) with unsaved changes shows the same prompt.
- **Closing or refreshing the browser tab** with unsaved changes shows the browser's own "Leave site?" warning. The app also keeps a temporary copy on that device and offers to restore it the next time the draft is opened, if it's newer than the server copy.
- Only one save runs at a time, and the last change always wins, so a slow save can't overwrite newer edits.

## Safeguard 3: Incomplete drafts
- A draft can be saved with no name, no type, no criteria, no location and no contact.
- To fit the existing database rules:
  - **Name** is saved empty and shown as "Untitled draft" in the list.
  - **Criteria** are saved empty.
  - **Type** is allowed to be blank, which the database already permits.
  - **Contacts** are kept in the draft's own saved notes, not linked to the sheet. Buyer-only and Personal-only rules therefore aren't triggered until the agent finishes.
- A blank or bad price, number of bedrooms, and so on is kept as typed, so a half-entered field can't cause a save error.
- An automated database test inserts an entirely empty draft and confirms every existing rule accepts it.

## Safeguard 4: Safe QA (no activation in the shared environment)
- The preview shares the live database. So in the preview I will **not** finish or activate any Hot Sheet, and I won't create any test contacts.
- Preview checks, signed in as you:
  - create a Personal draft and a Buyer-type draft with no contact;
  - check autosave, the unsaved-changes prompts, leaving and resuming, rename and delete;
  - stop before Create.
  - Both test drafts are deleted at the end and the count is confirmed back to the starting number.
- **Finishing is tested only inside database tests that undo themselves.** These tests make no lasting changes and run in the existing database test set (like the current Hot Sheet tests). They confirm:
  - finishing succeeds;
  - a failed contact link leaves the draft intact and off;
  - running finish twice changes nothing;
  - a draft never creates a buyer need;
  - drafts can't get batches or invitations, and match no listings.
- Before and after, I'll record the email queue count, active Hot Sheet count, buyer needs count and Hot Sheet alert count. All must be unchanged.
- No emails, invitations, batches or alerts.

## My Hot Sheets layout
- **Drafts** section at the top, then **Active Hot Sheets** below.
- Drafts show a Draft badge, "Untitled draft" when there's no name, and when they were last saved, plus Continue Editing, Rename and Delete.
- Drafts never count toward active totals or match counts.

## Technical details
- Migration (additive, no change to existing rows):
  - `hot_sheets.is_draft boolean NOT NULL DEFAULT false`, `hot_sheets.draft_state jsonb` (pending contact IDs, selected listing IDs, raw form values, UI step), and a partial index on `(user_id) WHERE is_draft`.
  - A BEFORE INSERT/UPDATE trigger forces `is_active = false` while `is_draft`.
  - Triggers on `hot_sheet_clients` and `hot_sheet_recipient_batches` reject inserts when the sheet `is_draft`.
  - `sync_hot_sheet_to_client_needs` gets a `WHEN (NOT NEW.is_draft)` trigger condition; its function body is unchanged.
  - `finalize_hot_sheet(p_hot_sheet_id uuid, p_name text, p_criteria jsonb, p_sheet_type text, p_client_ids uuid[], p_notify…)` is a SECURITY DEFINER plpgsql function in one transaction:
    - it locks the row FOR UPDATE and checks the owner via `auth.uid()` (or a delegate check matching the existing patterns);
    - it validates the inputs, runs `INSERT hot_sheet_clients`, and then runs `UPDATE is_draft=false, is_active=true, draft_state=null`;
    - any exception rolls back everything.
  - Execute is granted to `authenticated`.
- Matching already filters on `is_active` (for example `hot_sheet_criteria_matches`, `count_matching_agents`, `get_hot_sheet_for_member`, `list_hot_sheets_for_member`). Each one gets a test that a draft is excluded. `process-hot-sheet` and `send-hot-sheet-invite` refuse drafts.
- `CreateHotSheetDialog.tsx`:
  - draft session built like `addListingDraftSession.ts`: a single create, then updates; saves don't overlap; changes made during a save are tracked and saved next; status shows saving, saved (only after the server confirms) or error;
  - close guard, an in-app leave guard, and a browser-tab warning;
  - the existing local copy is reused as the on-device backup with a timestamp;
  - Create calls `finalize_hot_sheet` instead of separate inserts.
- `HotSheets.tsx`: Drafts section first; active lists and counts filter on `is_draft = false`.
- Tests:
  - Vitest for the draft session (save state, no create on open, no overlapping saves, close guard);
  - SQL tests for empty-draft constraints, all-or-nothing finish with undo, running finish twice, no buyer-need sync and no matching for drafts.
- AGENTS.md: drafts are `is_draft` rows; only `finalize_hot_sheet` activates a draft or new sheet, in one all-or-nothing step.
- Nothing is deployed until you approve this plan.
