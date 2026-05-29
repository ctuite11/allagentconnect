## Plan

1. Update the shared email sender used by the queue so it honors `payload.from` when present, instead of always building the sender from the default `hello` address.
2. Update the shared email job type to include the optional `from` field already being written by `send-bulk-email`.
3. Redeploy the queue-processing email function so the deployed sender logic uses the new override.

## Technical details

- `send-bulk-email` is already enqueueing:
  - `from: "Chris Tuite <chris@allagentconnect.com>"`
- The issue is downstream: `supabase/functions/_shared/sendEmail.ts` currently sends every queued email with:
  - `All Agent Connect <hello@mail.allagentconnect.com>`
- I’ll change that to:
  - use `job.payload.from` if present
  - otherwise fall back to the existing default sender

This keeps other system emails unchanged while allowing the Founding Partner/bulk campaign path to send from Chris.