# Confirm photo order before publishing

## Why

A hot sheet alert for 8 Wright St #2 went out with a bedroom as the lead photo. Timeline (Aug 10, UTC): the listing was published at 15:17:22, the alert job was created at 15:17:24, and the photo set was finalized at 15:18:00. The email was correct at that instant — the living-room cover photo simply arrived 36 seconds after the alert was built.

Fix: make the agent explicitly confirm photo order at the moment of publishing, so the first photo is settled before any alert fires.

## What to build

A confirmation step in front of publishing on the Add/Edit Listing page.

When the agent clicks **Publish Listing** (or saves an existing listing into a live status), instead of publishing immediately, show a dialog:

- Title: "Is your photo order correct?"
- A note that the **first photo** is what buyers and agents see in listing alerts and shared links, and that it cannot be changed after the alert goes out.
- A small thumbnail strip of the current photos in order, with the first one labeled "Cover photo".
- Buttons: **Go back and reorder** (closes the dialog, no publish) and **Yes, publish** (proceeds with the existing publish flow exactly as it works today).

Behavior details:
- Only shown for real publishes — never for Save Draft, never for autosave.
- Runs after existing validation passes (so the agent doesn't confirm photos then get bounced for a missing field).
- If the listing has no photos, the dialog is skipped (validation already blocks live statuses without photos).
- No changes to what gets saved, to statuses, to alert sending, or to any email code.

## Technical notes

- Single file changed: `src/pages/AddListing.tsx`.
- Add local state (`photoOrderConfirmOpen`, plus a pending-submit ref) and a shadcn `Dialog` (already imported in this file).
- `handleSubmit(e, true)` runs validation first, then opens the dialog and returns; confirming re-enters the same publish path with a flag set so it does not re-prompt.
- The same gate applies to the manual update path when the target status is live (`isLiveStatus(formData.status)`), so a draft-to-live edit is also covered.
- Thumbnails come from the existing `photos` state (`FileWithPreview` preview/url), no new upload or storage work.
