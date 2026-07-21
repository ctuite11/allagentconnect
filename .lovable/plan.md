## Diagnosis

The "Preview Comms guide email" button enqueues a row in `email_jobs` with:

```
idempotency_key: `comms-guide-${email}-${today}`
```

where `today` is `YYYYMMDD`. Because we sent the preview multiple times today while iterating (route fix, grammar fix, etc.), the queue now has a row with that exact key. On the next click, the insert hits the unique-idempotency constraint on `email_jobs` and returns an error — no new email is enqueued, so nothing arrives. The toast surfaces "Failed: …" (or shows success while nothing sends, if the error is swallowed).

## Fix

Make the admin preview button always send a fresh email by making the idempotency key unique per click, only for this preview path — leave the regular per-recipient/day dedupe alone for real broadcast sends.

Edit `supabase/functions/send-comms-guide-email/index.ts`:

- Accept an optional `preview: boolean` flag on the request body.
- When `preview === true`, append a timestamp/UUID to the idempotency key (e.g. `comms-guide-preview-${email}-${Date.now()}`) so every click enqueues a new row.
- Leave the default path unchanged (still `comms-guide-${email}-${today}`) so future bulk sends stay deduped.

Edit `src/pages/AdminApprovals.tsx`:

- On the "Preview Comms guide email" button, pass `preview: true` in the invoke body.

Redeploy `send-comms-guide-email`.

## Verification

1. Click **Preview Comms guide email** in Admin Approvals.
2. Confirm a new email arrives in the admin inbox each click (multiple clicks = multiple emails).
3. Click the CTA in the email → lands on `https://allagentconnect.com/communications` (from the previous fix).

No template, styling, recipient logic, or bulk-send behavior changes.