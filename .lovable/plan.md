# Personal vs Buyer Hot Sheets (Option C) + clean up "mine"

## What I found (read-only, nothing changed)
- **The invitation was never delivered.** It was handed off at 11:00 PM on Oct 12 (New York time). It was delayed all day and finally bounced at 1:00 PM today with "unable to deliver… no such domain allagentconnet.com". No one received it, and nothing will retry.
- **The link is still technically open.** One unused invitation link exists for that contact: not accepted, not cancelled.
- **The misspelled "Chris" contact (created May 29) is used only by "mine".** It isn't linked to any other Hot Sheet or saved first batch. It has one *pending* buyer connection record, created by that invitation click, with no buyer account attached.
- **"mine" has one saved first batch** with 1 listing, never sent.

## 1. Personal is a saved Hot Sheet type
- Each Hot Sheet gets a saved type: **Personal** or **Buyer**.
- Existing sheets are labeled automatically: sheets with contacts become Buyer, sheets without become Personal. This doesn't change how any of them behave today.
- **Create Hot Sheet** gets a clear choice: "Personal — Just for Me" or "For a Buyer". Choosing Personal hides the contacts section and saves with no contacts.
- **Review / Edit for Personal sheets:** no Send First Batch, Invite, Send All Listings, or other buyer buttons. Criteria editing and match review work as usual.
- **Server enforcement:** the database refuses to attach a contact or save a first batch on a Personal sheet. The invitation step also refuses Personal sheets, so a stale or crafted request still can't invite anyone. To invite a buyer, the agent first changes the sheet to Buyer (an explicit action).

## 2. Self-invite warning
- In Create/Edit (Buyer type), if a picked contact's email matches the agent's own login email, or looks like a near-miss of it (e.g. one letter off, like allagentconnet vs allagentconnect), show: "This looks like you. Make this a Personal Hot Sheet instead?" with **Switch to Personal** or **Keep as Buyer**.
- The same check runs before "Send First Batch & Invite" on Review.

## 3. Your data (only your account)
In this order, by exact ID:
1. Cancel the invitation link (`00790dbf…`) by marking it cancelled, not deleting it, so the record stays.
2. Remove the pending buyer connection for that contact (no buyer account was ever attached).
3. Remove "mine"'s saved first batch (`9824a8b6…`). Your 1 selected listing is kept as a Personal pick on "mine", so it still shows pinned in Review.
4. Detach the contact from "mine" and set "mine" to **Personal**. Name and criteria are unchanged.
5. Delete the misspelled "Chris" contact (`ba16414c…`), since it's used nowhere else.
- The email record and its bounce history are kept for audit.

## Impact on saved data
- One new setting on every Hot Sheet. Other agents' sheets only get a label that matches how they already behave. Their contacts, batches and sending are untouched.
- Data removed: only the five items above, all yours.
- **One detail to confirm:** the misspelled email will no longer exist as a contact. If you want it kept and corrected to chris@allagentconnect.com instead, tell me.

## Safety
- No emails, invitations, batches or notifications. Email queue count recorded before and after.
- The Buyer workflow, pending-contact flow and the Review fixes (pinning, count, persistence) stay the same. The locked Hot Sheet rules and their tests stay in place. New tests cover Personal sheets.

## Technical details
- Migration: `hot_sheets.sheet_type text NOT NULL DEFAULT 'buyer' CHECK (in ('personal','buyer'))`, backfilled to `personal` where no `hot_sheet_clients` rows exist. Triggers on `hot_sheet_clients` and `hot_sheet_recipient_batches` reject inserts for personal sheets. Add `hot_sheets.personal_listing_ids uuid[]` so the selected listing is kept without a recipient batch.
- The invite path (`enqueueHotSheetClientInvites`, plus the server function it calls) rejects personal sheets.
- `CreateHotSheetDialog.tsx`: type toggle. `HotSheetReview.tsx`: hide buyer CTAs when the sheet is personal. Self-match helper in `src/lib/hotSheetRules.ts` with tests in `hotSheetRules.test.ts`.
- Data step: `share_tokens.revoked_at = now()`. Delete the pending `client_agent_relationships` row, the batch row, and the `hot_sheet_clients` row. Set the sheet type to personal. Delete the client row. AGENTS.md: Personal/Buyer is an explicit saved type, enforced server-side.
