# Eric Klein: reconcile Pending in the admin panel

## Confirmed records
- Eric's License Verified email to ericklein1@gmail.com is marked sent and delivered on October 26 at 6:39 PM New York time.
- His account is verified, has an activation timestamp at 6:42 PM, and a sign-in recorded at 6:42 PM.
- Account lifecycle and email delivery are separate. The checked-in lifecycle logic would classify an account with a sign-in as Activated.
- The admin roster retains cached results and can keep them on screen after a failed refresh. Whether that explains Eric's Pending label is unconfirmed.

## Plan
1. **Trace the discrepancy read-only.** Compare Eric's live admin roster response with the displayed row, its account identifier, matching request records, cached state, and refresh errors. Do not assume a cache problem or overwrite account data.
2. **Resolve only the verified display problem.** If a successful refresh corrects the label, report that and make no code change. If the response or display mapping is demonstrably wrong, present the smallest proposed correction for approval before changing or deploying it.
3. **Verify without sending.** Confirm the displayed account stage agrees with Eric's existing sign-in and activation records, and email history shows Delivered. Delivery alone must never activate an account.

## Boundaries
- No sends, resends, queue writes, backfills, password changes, or account-status edits.
- No frozen email-template changes, admin redesign, or Cloud resize. The earlier resize did not execute.
- Record this investigation in the task list when implementation mode permits other file edits.

## Technical details
Compare `admin-list-agents` lifecycle output with `AdminApprovals` cached roster and refresh behavior, plus `AgentEmailHistory` delivery data. Any later approved correction needs a focused regression test for the identified data/refresh rule and an authenticated admin verification without email actions.
