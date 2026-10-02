# Missing Publish button on the test Draft — findings (read-only)

## Finding: not a regression. My earlier test opened the wrong page.

- The browser check went to `/add-listing/c55f3be5-…`. That address doesn't exist in the app. The real address for editing a listing is `/agent/listings/edit/:id`. So the check never reached the listing editor, and it found no Publish button because there was no editor on the page. The Draft itself was never the problem.
- The Draft is fine: L-1407 is still `draft`, it belongs to Chris, and its saved intended status is Coming Soon.
- The editor still shows Publish for every Draft. When an existing Draft is opened, the bottom bar shows **Save Draft / Preview / Publish**. Nothing about the individual listing can hide the Publish button there. This applies to all Drafts, not just this one.
- Today's four fixes didn't touch the Publish button. The only change to the editor today added the social on/off switch in four places: the import, the two background social-status checks, the social section of the popup, and the "Share this update?" prompt. None of these affects which buttons appear or how publishing works. The other fixes changed different files: the public property page, the unsubscribe table, and the admin email summary.

## Proposed next step: read-only confirmation in the browser

1. Sign in as Chris and open `/agent/listings/edit/c55f3be5-d0af-4b09-b19e-36b9d42897d4`. Close the intro popups.
2. Take a screenshot showing the bottom bar with Save Draft / Preview / Publish.
3. Click Publish. Confirm "Ready to publish?" opens right away, has no social section and no "…" buttons, and shows "Yes, Publish Listing".
4. Click **Go Back**. Never click "Yes, Publish Listing".
5. Confirm the listing is still `draft` and nothing new was added to its status history, emails, Hot Sheet records or social records.

No code changes, no publishing, no emails, no Hot Sheet events, no social posts. If step 2 doesn't show Publish, I'll report back before changing anything.
