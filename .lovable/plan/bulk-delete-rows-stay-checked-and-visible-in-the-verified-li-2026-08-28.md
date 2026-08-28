# Bulk delete: rows stay checked and visible in the verified list

## What actually happened

The deletion worked. I checked the database directly: 20 agents were archived at 18:35:02 today, and for every one of them there are zero remaining agent profile, profile, and settings rows. The backend logs also show the 20 login accounts being deleted between 18:35:31 and 18:36:07. Nothing is left behind.

What failed is the Admin Approvals screen refreshing itself. It showed you a stale list.

## Why the screen still shows them

1. The page keeps a 5-minute cached copy of the agent list (in memory and in session storage) so it renders instantly. Nothing clears that cache after a delete.
2. Refreshes are de-duplicated: if a background refresh is already running, a new request just waits on the old one. The bulk delete takes ~60 seconds, so the refresh that fires when it finishes can be an already-running request whose data was fetched *before* the delete — that stale list is then written into state and into the cache.
3. The backend list function itself takes several seconds and was reading the accounts while they were still being purged, so even a fresh call made immediately can return some of them.
4. The checkboxes stay ticked because the rows come back with the same ids; and if anything throws mid-delete, the "clear selection + refresh" callback never runs at all.

## Fix

Frontend only, in `src/pages/AdminApprovals.tsx` and `src/components/admin/BulkDeleteAgentsDialog.tsx`. No changes to deletion logic, RPCs, edge functions, or emails.

1. **Optimistic removal.** When the bulk delete reports which agents were removed, drop those ids from the on-screen list immediately, so they disappear the moment the dialog closes.
2. **Clear the cache.** Invalidate the in-memory and session-storage admin agent cache on every delete (single and bulk) so a reload can't resurrect them.
3. **Force a genuinely fresh refresh.** Give the refresh helper a `force` option that ignores an in-flight (possibly stale) request and starts a new one, and use it after deletions. Add a short delayed second refresh so the backend has finished purging login accounts before the final list is drawn.
4. **Always clear selection.** Reset checkboxes in a `finally` block in the bulk dialog so a partial failure can't leave stale ticked rows, and report the outcome as it currently does.
5. **Guard the whole bulk run** with try/catch/finally so an unexpected throw can't leave the progress bar spinning or skip the refresh callback.

## Verification

- Typecheck and production build.
- Confirm in the database that the 20 deleted agents remain fully removed (already true).
- No emails, no invitations, no re-enqueued jobs, no schema changes.
