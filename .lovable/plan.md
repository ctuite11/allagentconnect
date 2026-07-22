## Problem

`notify-agents-new-listing` enqueues jobs with `template: "agent-new-listing-alert"`. `renderEmailTemplate.ts` has no case for that template, so it falls through the `default:` branch and renders the literal string `"Email template: agent-new-listing-alert"`. The queue then marks the job `sent`. Confirmed impact: **329 sends in the last 7 days**, most recently a batch to verified agents for `309 E Street, South Boston, MA` on 2026-07-22 at 13:00 UTC.

## Fix (4 parts)

### 1. Render `agent-new-listing-alert` properly

In `supabase/functions/_shared/renderEmailTemplate.ts`, add a dedicated `case "agent-new-listing-alert":` that uses `buildAacEmail` with:
- Headline: `"New listing in your coverage"`
- Preheader: address line
- Body: greeting to `variables.userName`, one-line context, then `variables.listingsHtml` (the pre-rendered listing card the caller already builds via `renderHotSheetMatchListingEmailCard`)
- CTA: `"View listing"` → `variables.hotSheetLink`

No changes to `notify-agents-new-listing`; its payload already carries the right variables.

### 2. Fail-closed guard on unknown templates

Replace the silent `default:` fallback in `renderEmailTemplate.ts` with a thrown error:

```ts
default:
  throw new Error(`Unsupported email template: ${template}`);
```

In `process-email-queue/index.ts`, catch that error in the per-job try/block and mark the job `failed` (not retried, not `sent`) with `last_error = "Unsupported email template: <name>"`. Do not consume attempts against Resend for these — they should short-circuit before send.

Add a small allow-list check at enqueue time is out of scope; the renderer + worker guard is the authoritative gate.

### 3. Audit the 329 affected sends

Produce a CSV export at `/mnt/documents/agent-new-listing-alert-audit.csv` with: `created_at`, `recipient`, `subject`, `listing_id` (from `payload->metadata->>listing_id`), `agent_id`, `status_at_send`. Deduplicate by recipient+listing. Report totals (unique recipients, unique listings, date range) in chat so you can decide next steps.

No auto-resend. Deciding whether/how to notify affected agents is a separate step after you review the audit.

### 4. Verification

- Redeploy `process-email-queue` (renderer is imported by it).
- Trigger `notify-agents-new-listing` with `dry_run:false` on a test listing to a single test recipient; confirm the email renders with the listing card and CTA, and that `email_send_log`/`email_events` show `sent`.
- Enqueue a synthetic job with `template: "bogus-template"` and confirm it lands as `failed` with the `Unsupported email template` error and no Resend call.

## Files touched

- `supabase/functions/_shared/renderEmailTemplate.ts` — new case + throw on default
- `supabase/functions/process-email-queue/index.ts` — catch unsupported-template error → mark `failed`, skip Resend
- (audit only) query + CSV to `/mnt/documents/`, no code change

## Out of scope

- Redesigning the listing card
- Automatic resend to the 329 recipients
- Changes to `notify-agents-new-listing` logic, audiences, or dedup
