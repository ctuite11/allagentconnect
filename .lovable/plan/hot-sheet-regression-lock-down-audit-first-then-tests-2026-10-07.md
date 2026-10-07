# Hot Sheet regression lock-down (audit first, then tests)

No Hot Sheet changes, emails, invites, saves, or data changes until you approve this plan.

## Initial findings (read-only, from this turn)

- **Status defaults:** wrong value introduced 2026-04-22 (commit `34586f894`, criteria moved into `hotSheetCriteriaCore.ts`). It went unnoticed because nothing tests it. Create, Edit, and the Comms Center builder all read one shared constant, so the source of truth is OK; only the test is missing.
- **Connected buyer:** decided in Hot Sheet Review (`buyerConnected`), plus separate relationship lookups in about 15 other files (Buyer Detail, Hot Sheets, Success Hub, buyer status, and others). Several compute "connected" on their own. This is the main reason the logic drifted.
- **First invite vs reminder:** `sendDashboardInvite` logic was copied into both `HotSheetReview.tsx` and `enqueueHotSheetClientInvites.ts` (May 2026). The stale-token filter is now shared, but the eligibility rule is still duplicated.
- **Add Additional Contact:** built separately in Create and Edit. Create had saved contacts in edit mode without ever writing them, and Edit had no Contacts section. There is no shared contacts component.
- **Duplicate email rules are not enforced as specified:**
  - The other-member case shows "This person is already registered with another agent." This is the wrong text, it appears in two places, and it comes as a pop-up notice rather than blocking at the field.
  - An existing contact for the same agent shows "already exists in your list" and recovers through a separate dialog. It does not reliably auto-select that contact.
  - The required message "This email is associated with another member and cannot be added." appears nowhere in the code.
- **Contact search dropdown overlapping manual add:** not checked yet. Step 1 covers it.
- **Tests:** Vitest is set up, but no Hot Sheet tests exist.
- **Commit history:** most recent Hot Sheet commits are labeled only "Changes" (13 on Oct 7). Step 1 maps each one by its diff.

## Step 1: Finish the audit (read-only, report only)

1. Go through the Hot Sheet commit diffs since June 2026 and match each to a rule it set, changed, or broke.
2. List every place that decides each locked rule, and mark where they disagree.
3. Check the contact search dropdown (close on select or blur, layering over the manual-add form) in Create and Edit.
4. Send you the report: responsible commits and components, the duplicated logic list, and test gaps. Then stop.

## Step 2: Centralize (smallest change, after your approval)

Create one shared rule module and point existing screens at it. Screens and behavior stay the same.
- `isBuyerConnected` (active relationship only)
- `isFirstInviteEligible` (built on the existing stale-token filter)
- `resolveContactEmail`: existing contact for this agent → select it; another member → block with the exact required message
- The status default and order constants stay where they are.
- One shared Contacts section used by both Create and Edit, if the audit confirms it can be extracted without visual changes.

## Step 3: Regression tests (before any further Hot Sheet work)

Vitest unit tests covering every locked rule:
- Defaults are exactly Coming Soon + Off Market, and those two are first in the list.
- Connected only with an active relationship. Ended relationships and accepted invites alone do not count.
- A pending buyer gets "Send First Batch & Invite"; a connected buyer gets "Send First Batch".
- A stale token whose contact or Hot Sheet was deleted does not block a first invite. A legacy token without those IDs is still respected.
- Duplicate email: same-agent contact is selected; another member is blocked with the exact message.
- Add Additional Contact is shown in Create (including from a buyer) and in Edit. It cannot remove the last contact.
- The search dropdown closes after selection.

Also add a line to the project rules saying these rules are locked and must not change without their tests changing too.

## Out of scope

Matching, notifications, templates, dedupe, backend batch logic, the two waiting batches, and any real sends.
