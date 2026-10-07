# Hot Sheet regression audit: Step 1 report and proposed lock-down

The audit was read-only. No code, data, emails, invites, or the two waiting batches were touched. Approving this plan approves only Steps 2 and 3 below, which need your sign-off separately.

## 1. Commits behind each locked rule

| Rule | Introduced / changed | Regression cause |
|---|---|---|
| Default statuses = Coming Soon + Off Market | `34586f894` (2026-04-22): consolidation set 4 defaults (adding ACT and BOM). Corrected in `648298180` (2026-10-07). | One wrong value written at consolidation; no test caught it. |
| Coming Soon and Off Market first | Order in `src/constants/status.ts`. Fixed `648298180`. | Never encoded as a rule; the list order drifted. |
| Connected = active relationship only | `6c330413e`, `3748ad5c5` (2026-05-08); `39eeeff57` (2026-06-20); fixed `1ca917c91` (2026-10-07) | The June 20 "already-connected" fix treated an email-matched accepted invite as connected. The backend never did. |
| Pending buyer sees "Send First Batch & Invite" | CTA work `61c46bbb8`, `6366a0e86`, `6076ea223` (June 22–23); current label `d3f8d31a3` (2026-10-06) | The label depends on the connected signal above, so it broke whenever that broke. |
| Stale or deleted invites must not block a first invite | Global email match added in `6c330413e` (2026-05-08), copied into `enqueueHotSheetClientInvites.ts` 2026-05-12. Filter added 2026-10-07. | The lookup never checked whether the contact or Hot Sheet still existed. |
| Add Additional Contact in Create and Edit | Added `9fd969804` (2026-02-16), removed `50a84f0cc` (2026-02-18). Restored in Create `f45b28ce5` (2026-10-07); Edit added 2026-10-07. | Removed two days after it shipped, as a side effect of a larger change labeled only "Changes". |
| Duplicate-email enforcement | Unique index `clients_agent_email_unique` (agent + email) created 2026-04-20, re-created 2026-05-28. | The other-member rule was never implemented as specified (see section 3). |

Most Hot Sheet commits since August carry only the message "Changes", so intent can't be recovered from history. That is part of why decisions get lost.

## 2. Where each rule is implemented, and disagreements

- **Status defaults and order:** one constant (`hotSheetCriteriaCore.ts` plus `constants/status.ts`), used by Create, Edit, and the Comms Center builder. No disagreement now.
- **Connected buyer:** decided in Hot Sheet Review (`buyerConnected`) and the backend `process-hot-sheet`. About 15 other screens also query relationships themselves, including Buyer Detail, the Hot Sheets list, Success Hub, `buyerStatus`, `resolveActiveBuyerAgentId`, and Buyers List.
  - Disagreement: not every query filters `ended_at IS NULL` and `status = active` the same way, so a buyer can show as "connected" on one screen and "pending" on another.
- **First invite vs reminder:** `sendDashboardInvite = !buyerConnected && globalMerged.length === 0` is duplicated in `HotSheetReview.tsx` and `enqueueHotSheetClientInvites.ts` (no callers, but still a second copy). The backend `send-hot-sheet-invite` has its own resend logic.
- **Contacts section:** built twice, in `CreateHotSheetDialog.tsx` (about 200 lines) and `EditHotsheetCriteriaDialog.tsx` (a separate copy). Create's own edit mode loads contacts but never saved changes to them until today.
- **Duplicate-email rules:**
  - Other member: a pop-up "This person is already registered with another agent." appears in two places (Create line 471, Edit line 251). It is not field-level, the wording is wrong, and it is checked only in the browser (`check_client_has_other_agent`). The manual-add path only reports an insert error.
  - Same agent: the database unique index blocks a second row, which is good. But the browser shows "A contact with this email already exists in your list" and runs a recovery lookup plus `DuplicateContactDialog`, instead of automatically selecting the existing contact.
  - `CreateBuyerDialog` and `SaveToHotSheetDialog` each have their own version of these checks.
  - The required message "This email is associated with another member and cannot be added." appears nowhere.

## 3. Contact dropdown (Create and Edit)

- Both use the same pattern: a floating list layered on top of the form, closing on selection or 200 ms after the field loses focus.
- While the search field is focused and has results, the list floats over whatever sits below it, including the manual-add form in Create. That is the reported overlap.
- It does not close on Escape or when a search returns empty. Create and Edit are separate copies, so a fix to one doesn't reach the other.

## 4. Test gaps

Vitest is configured, but there are zero Hot Sheet tests. None of the locked rules has a test, and no duplicate-email database rule is tested.

## Step 2: Proposed lock-down (smallest change, behavior-preserving)

1. **`src/lib/hotSheetRules.ts`**, a single frontend source of truth:
   - `isBuyerConnected(relationship)`: active and not ended.
   - `getFirstBatchCta(connected)`: returns the button label.
   - `isFirstInviteEligible(connected, liveTokens)`: built on `filterStaleInviteTokens`.
   - Status defaults and order are re-exported from where they already live.
   - Hot Sheet Review and `enqueueHotSheetClientInvites` call these instead of the inline copies.
2. **Duplicate email, enforced server-side** in one authoritative database function, `add_hot_sheet_contact(email, ...)`:
   - Same agent, existing contact: returns that contact's id and creates nothing.
   - Email belongs to another member: rejects with exactly "This email is associated with another member and cannot be added."
   - Otherwise: creates the contact.
   - Create, Edit, CreateBuyer, and SaveToHotSheet manual-add all call it. The browser pre-check stays only for early feedback, using the same message. The existing unique index stays as a backstop.
3. **One shared `HotSheetContactsSection` component** used by Create and Edit, with the same visuals. The dropdown closes on select, blur, Escape, and empty results, and sits in the normal page flow when the manual-add form is shown, so it can't cover it.
4. A rule in `AGENTS.md` naming these as locked, with tests required.

## Step 3: Regression tests

Vitest covering:
- defaults and order
- connected = active relationship only (ended relationships and accepted invites alone don't count)
- CTA label for pending vs connected buyers
- stale and legacy token handling
- same-agent duplicate selects the existing contact; another member is blocked with the exact message (tested against the database function's documented results)
- Contacts section: Add Additional Contact present, the last contact can't be removed, and the dropdown closes

## Out of scope

Matching, notifications, templates, dedupe, backend batch logic, the two waiting batches, and any sends.
