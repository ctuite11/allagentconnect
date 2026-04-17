

## Issue: DCMLS consumer auth changes not visible

The user is on `/` (preview origin = `id-preview--...lovable.app`, not a DCMLS host). The DCMLS consumer header only renders on DCMLS hosts or when `?dcmls=1` is in the URL. So the new dual CTA header may not be showing because:

1. They're viewing on the preview/AAC host without the `?dcmls=1` override.
2. OR the homepage on DCMLS is not actually rendering `DcmlsConsumerHeader`.
3. OR the buttons exist but they expected the changes elsewhere (e.g. `/auth` page itself).

Let me investigate what actually renders on the DCMLS surface and verify the wiring is correct.

### Investigation steps

1. Check `src/pages/Index.tsx` (or whatever `/` renders) to confirm it branches on `isDcmlsHost()` and renders the DCMLS header.
2. Check `src/App.tsx` to confirm `/consumer/auth` is wired to `DcmlsAuth`.
3. Check current state of `DcmlsConsumerHeader.tsx` to confirm dual CTA is in place.
4. Check what the published DCMLS site (`directconnectmls.com`) actually serves — Lovable preview vs published deploy may differ. Changes only appear after publish.

### Likely root causes

- **Most likely**: User is checking `directconnectmls.com` (production), but the project hasn't been republished since the changes. Lovable preview reflects latest code; custom domains require publish.
- **Possible**: User is on preview origin without `?dcmls=1`, so the AAC header renders instead.
- **Possible**: Homepage isn't host-aware and always renders the AAC layout.

### Plan

Once approved, switch to default mode and:

1. Verify `DcmlsConsumerHeader` has the dual CTA (Sign In + Create Account + secondary Agent link) — read the file.
2. Verify the DCMLS homepage and key consumer routes (`/`, `/browse`, property detail) actually render `DcmlsConsumerHeader` when `isDcmlsHost()` is true.
3. Verify `/consumer/auth` route is registered in `App.tsx` and resolves to `DcmlsAuth`.
4. If wiring is broken, fix it. If wiring is correct, instruct the user to either:
   - Append `?dcmls=1` to the preview URL to see DCMLS skin, OR
   - Publish the project so `directconnectmls.com` picks up the latest changes.

No new features. Pure verification + any wiring fix needed.

