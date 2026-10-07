# Fix: review page treats an unconnected buyer as connected

Scope: steps 1 and 2 only. Nothing will be sent, invited, or resent.

## Exact cause (confirmed)
The review page decides "connected" with three signals, and any one of them is enough:
1. an active buyer–agent relationship
2. an accepted invitation found **anywhere**, matched by email address
3. an accepted buyer workspace invite, matched by email address

For chris.tuite@compass.com:
- Relationship: **none** (no row in `client_agent_relationships`)
- Workspace invite: none
- Accepted invitation: **one, from May 16, 2026.** It belongs to a contact record that has since been deleted (`a8e3f4d2…`), on a Hot Sheet that no longer exists (`48b197db…`). It was never turned into a relationship.

Signal 2 matches that old invitation by email, so the page marks today's buyer as "connected." It then shows **Send First Batch** without an invitation. The backend still stores the batch as pending, because it checks the real relationship. That's why both batches are waiting with no invitation sent.

## Fix (one place, `src/pages/HotSheetReview.tsx`)
Only the "is this buyer connected" decision on the review page changes:
- **Connected** means an active relationship for this contact (signal 1), or an invitation accepted for **this** Hot Sheet. The second case already counts separately and stays unchanged.
- Old accepted invitations matched only by email (signal 2) no longer count as connected. Neither do email-matched workspace invites (signal 3).

Result:
- Buyer with no active relationship: **Send First Batch & Invite**
- Actually connected buyer: **Send First Batch**, same as today

## Not changed
Matching, stored batches (both waiting batches stay untouched), alert frequency, email templates, duplicate prevention, the send function, the new UI and copy, and the shared buyer-status rules used on other pages.

## Verification (no Send pressed)
- "kerri" and "Buyer 1 Boston Condo's" show **Send First Batch & Invite**.
- "sdfdsafdsa" and "New buyer boston…" still show **Send First Batch**. Their relationship status will be checked first. If they turn out to be connected only by the same old invitation, I'll report that instead of guessing.
- Email queue count stays at 16,528. No invitations are logged.
- I'll report the exact code change, then stop until you approve a real invitation test.

## Flag for the later invite test (not changed now)
The "send a first-time invitation" choice also looks at that old May invitation. As a result, pressing **Send First Batch & Invite** for this buyer might pick the reminder style rather than a first invitation. I'll confirm that read-only before you approve the real send.
