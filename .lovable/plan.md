# Audit: last Hot Sheet email attempt (read-only, nothing changed)

## What happened
- **When:** 02:08 UTC Oct 7 (10:08 PM New York)
- **Hot Sheet:** "kerri" — created 20 seconds earlier by chris@allagentconnect.com
- **Buyer:** chris tuite (chris.tuite@compass.com)
- **Action:** Send First Batch with **62 listings** selected
- **Result:** the send succeeded (no "could not be sent" error). The 62 listings were saved as this buyer's first batch.

## Why no email went out
- **0 emails were created** (email queue still at 16,528; nothing queued in the last 30 minutes).
- This buyer is **not connected** to you yet (no accepted invitation), so the system correctly held the 62 listings until the buyer accepts. It did **not** email them.
- **No invitation was sent either.** No invite was logged in the last hour.

## The real problem
For a buyer who isn't connected yet, the button should say **Send First Batch & Invite** and send the invitation. Here it said **Send First Batch**: the page wrongly treated this buyer as already connected (we saw the same thing during the earlier test on "Buyer 1 Boston Condo's"). Result: the listings are waiting for an acceptance that will never happen, because the buyer never got an invitation.

There are now two batches waiting like this for the same buyer: "Buyer 1 Boston Condo's" (8 listings) and "kerri" (62 listings).

The last emails that actually went out from Hot Sheets were agent status-change alerts on Oct 4. Both were sent.

## Proposed next step (needs your approval)
1. Find out why the review page treats an unconnected buyer as connected. Compare the page's check with the buyer's real connection status.
2. Fix only that check, so unconnected buyers see **Send First Batch & Invite** and the existing invitation is sent. No template changes. No changes to matching, alert frequency, or how duplicates are prevented.
3. Check on the review page without pressing Send. Then do one controlled send, but only if you approve it, because it will send a real invitation email.
4. Leave both waiting batches as they are. If you want, we can resend their invitations later, but only with your approval for each one.

## Technical notes
- Batch row `930db0a6…`: hot_sheet `deb2a9eb…`, client `665e416b…`, 62 IDs, `initial_batch_queued_at` null, `recipient_user_id` null.
- `client_agent_relationships` has no row for crm_client `665e416b…`. `invite_events` is empty for the last hour.
- Suspect: `hasPendingInviteRecipients` in `HotSheetReview.tsx` (~619–669, ~895) uses a different signal than relationship status.
