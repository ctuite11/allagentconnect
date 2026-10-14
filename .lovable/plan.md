# Fix Save Draft: window resetting and duplicate drafts

## What the recording and the data show

- Your three drafts were created at 8:39:17, 8:39:30 and 8:39:38 PM. Each was saved once and never updated again. That fits the pattern exactly: autosave saves, the page reloads behind the window, the window resets, and your next typing starts a brand-new draft.
- The quiet-refresh fix went to GitHub at 8:31:51 PM. It is live on allagentconnect.com now; I confirmed it in the live code. I can't prove exactly when the site finished updating. My own live test at about 8:36 PM did not reset, which means it was probably live by then. If so, your tab was most likely still running the earlier version, because the site only loads new code when a page is reloaded.
- Either way, last night's fix only removed one trigger. The real weakness is still there: if the window is ever reset for any reason, it forgets which draft it was working on and makes a new one. Today these can still reset it:
  - The My Hot Sheets page still shows its full loading screen when your sign-in session refreshes or your account details reload, and that removes the open window.
  - A save that reaches the server but whose reply is lost (slow network) could be retried as a brand-new draft.

## The fix

1. **The window never disappears during background activity.** My Hot Sheets shows its full loading screen only on the first load. Later refreshes happen quietly. The Create Hot Sheet window stays open in every case.
2. **One editing session keeps one draft.** The draft's ID is fixed the moment you start editing and saved on your device for that session. If the window is reset or the page reloads mid-edit, it reopens the same draft with your entries instead of starting a new one. The session ends only when you close the window yourself, finish the Hot Sheet, or delete the draft.
3. **A slow or failed save can't create a second draft.** Every save for a session uses the same draft ID. If a save is retried after a lost reply, it updates the existing draft instead of adding another.
4. **"Draft saved" appears only after the server confirms**, as it does now. A failed save shows "Not saved – Retry".

The same protections apply wherever the Create Hot Sheet window opens: My Hot Sheets, My Clients, the buyer pages and the client dashboard.

No other behavior changes. Finishing a Hot Sheet, Personal vs Buyer, contacts, Review, matching and notifications stay as they are.

## Your existing drafts

"new test", "test new" and "another test" are left exactly as they are for tracing. I won't change or delete them without your OK.

## QA (no emails, invitations, batches, notifications or activations)

Preview first, then allagentconnect.com after the automatic deploy, signed in as you, using clearly named temporary drafts:
- Type a name and wait through several autosaves. The window never flashes or closes, and the database shows a single draft row whose ID never changes while its saved time keeps updating.
- Change criteria repeatedly: still one row.
- Force a session/account refresh while the window is open: the window stays and nothing is lost.
- Reload the page mid-edit: the same draft and your entries come back, with no new row.
- Simulate a slow, lost-reply save and then retry: still one row.
- Close, then Continue Editing: same draft ID, entries restored.
- Delete the temporary drafts, then confirm draft, active Hot Sheet, email queue, buyer need and batch counts match the starting values and your active Hot Sheets are unchanged.

## Technical details

- `HotSheets.tsx`: track `hasLoadedOnce`; `fetchData` only calls `setLoading(true)` before first load (covers `checkAuth` re-runs on `authSessionUser?.id`/`authRoleLoading` changes, retry, share delete). Render the three `CreateHotSheetDialog` instances outside the loading early-return so they can never unmount.
- `hotSheetDraftSession.ts`: generate a client UUID at session start (or reuse the persisted one). `create` inserts with that `id`; on unique-violation (23505) it falls back to `update` on the same id. Add tests for lost-reply retry → single row, and for resume via the persisted id.
- `CreateHotSheetDialog.tsx`: persist `{draftId, snap, at}` under a per-user "active draft session" key in sessionStorage on first edit. On open in create mode, if an active session exists, resume that draft id and restore the snapshot automatically (instead of only offering a restore). Clear the key only on explicit close (Save Draft / close without saving / discard), finalize, or delete.
- No schema, edge function or email changes.

## Separate item: LinkedIn banner download

- I'll create a 1584x396 JPEG (LinkedIn's banner size) from your current homepage hero, using the cover image you uploaded: the logo with "Massachusetts", "ONE NETWORK. ALL AGENTS." and the man at the laptop.
- I'll re-crop it for LinkedIn's wider shape and keep the text clear of the bottom-left corner, where your profile photo covers part of the banner.
- You'll get it as a download in Files. The website doesn't change.
