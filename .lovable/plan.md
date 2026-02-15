

# Fix: Update FROM Email to Use Verified Resend Domain

## Problem

The `process-email-queue` edge function sends from `hello@allagentconnect.com`, but only `mail.allagentconnect.com` is verified in Resend. This causes a 403 error on every send attempt.

## Fix

One-line change in `supabase/functions/process-email-queue/index.ts` (line 164):

Change the default FROM email from:
```
hello@allagentconnect.com
```
to:
```
hello@mail.allagentconnect.com
```

This matches the verified Resend sending domain. No other files need changes.

## After Deployment

- The 2 stuck jobs (currently retrying) will succeed on the next cron tick
- All future emails will send from `hello@mail.allagentconnect.com`
- Reply-to addresses remain unaffected

