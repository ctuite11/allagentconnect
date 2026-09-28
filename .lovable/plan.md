# Keep the chosen status when a draft is saved

## Problem (confirmed in the code)
Save Draft correctly stores the listing as `draft`. When the draft is reopened, the form converts `draft` to `new`, so the status the agent picked (Off Market, Coming Soon, On MLS) is lost. No other saved field keeps it; there is no existing "intended status" field.

## Fix
- Add one new optional field to listings: `draft_intended_status` (empty by default, only allows valid listing status values, never `draft`).
- Save Draft, autosave, and the silent saves before Preview / Manage Photos / Manage Floor Plans: listing stays `draft`; the selected form status is also saved into `draft_intended_status`.
- Reopening a draft: the Status field shows `draft_intended_status`. Older drafts without it keep the current behavior (New).
- Publish: uses the selected form status as today, then clears `draft_intended_status`.
- Saving a draft never goes live, and never triggers Hot Sheets, emails, social posts, or DCMLS.

## Not changing
Hot Sheets, emails, social, DCMLS rules, the first-photo publish check, Edit of live listings, or any other page.

## Technical details
- Migration: `ALTER TABLE public.listings ADD COLUMN draft_intended_status text NULL` plus a check constraint limiting it to current status values (excluding `draft` and plain `withdrawn`). Additive only; existing grants and RLS cover it. Confirm no listing triggers act on this column.
- `src/pages/AddListing.tsx`: `buildListingDataFromForm` sets `draft_intended_status` when the target status is draft (covers handleSaveDraft line ~2654, autosave and pre-navigation saves ~2926/2958); set it to null on publish (~3405). `loadExistingListing` (~884) hydrates from it when status is draft.
- Check the Rental add-listing form for the same pattern and apply the identical fix if present.
- Heads-up: saving to GitHub main makes this live on allagentconnect.com immediately. Report exact changes after.
