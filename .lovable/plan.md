# Comms Filters Copy — What the Publish Covered, and What Is Still Missing

## Short answer

Your publish covered the **frontend**. It did **not** cover the **email side**, and redeploying the three edge functions would not fix that either — the email copy was never wired in.

## Verified now (read-only)

Frontend — live at `allagentconnect.com`:
- The served bundle changed from `assets/index-D2oVINkt.js` to `assets/index-D8yllcej.js`.
- The new bundle contains `section=filters`.
- `src/lib/commsFiltersCopy.ts` ships "Set Filters Now" / "Save Filters", and `src/pages/ClientNeedsDashboard.tsx` uses them.
- Report checks 1, 2, and 5 are satisfied by this publish.

Email — the actual gap:
- `supabase/functions/_shared/commsFiltersEmail.ts` exists and exports the notice block, CTA, and footer reminder.
- **No edge function imports it.** `send-client-need-notification`, `process-comms-digests`, and `process-email-queue` contain no reference to it.
- So report checks 3 and 4 are not a deployment problem. The helper is dead code until it is called. Redeploying those functions today would send byte-identical emails.

Containment (unchanged, not touched by this audit):
- `COMMS_EMAILS_PAUSED` remains as you set it. No enqueue, retry, send, cron, or migration action was taken or is proposed here.

## Proposed work (approval required)

Wire the existing helper into the two Comms email builders only:

1. `supabase/functions/send-client-need-notification/index.ts`
   - Insert `buildCommsFiltersNoticeHtml()` directly below the email heading in the broadcast item HTML.
   - Append `buildCommsFiltersFooterHtml()` at the end of the body.
2. `supabase/functions/process-comms-digests/index.ts`
   - Same two insertions in the `comms-digest` template body (once per digest email, not per item).
3. Deploy those two functions. `process-email-queue` needs no change — it does not build this body.

Explicitly out of scope: pause flags, cron schedules, recipient/opt-in logic, Hot Sheet, transactional, activation, password/account, and direct-message email. No test or live send will be triggered; verification is code-level plus a rendered HTML preview file, never a queue invoke.

## Note on the report's item 7 and the unpause question

This wording change does not make Comms safe to unpause. The permanent recipient opt-in enforcement is still the blocking item, and it stays paused until that ships and is verified separately.

## Technical detail

- Helper: `COMMS_FILTERS_URL` = `AAC_PUBLIC_URL` + `/communications?section=filters`.
- Insertion points: `itemHtml` construction in `send-client-need-notification`, and the digest body around line 416 of `process-comms-digests` where `item.item_html` is rendered.
- Verification after deploy: grep the deployed function sources for `section=filters`, and render a preview HTML to `docs/email/previews/` for visual check.
