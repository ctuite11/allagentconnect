## Goal
After a bulk email send fully succeeds from Admin Approvals, clear the row checkmarks without refetching the list — scroll position, row order, and filters are untouched.

## Changes

1. `src/components/BulkEmailDialog.tsx`
   - Add optional prop `onSent?: () => void`.
   - In `handleSend`, after the success toast for each branch (`comms-center-guide`, `custom`, templated `send-bulk-email`), and before the form reset + `onOpenChange(false)`, call `onSent?.()`.
   - Placement is inside the `try` block after the toast, so any thrown error short-circuits before the callback runs. Do not call `onSent` from the `catch` branch, early validation returns, or the `finally` block.

2. `src/pages/AdminApprovals.tsx`
   - Pass `onSent={() => setSelectedIds(new Set())}` to `<BulkEmailDialog />`.
   - Do NOT call `fetchAgents()` — clearing the selection Set alone rerenders row checkboxes in place with no scroll or list mutation.

## Out of scope
- Email sending logic, templates, recipients, toasts.
- Bulk verify / bulk delete flows.
- No new scroll restoration needed since the list is not refetched.
