## Goal
Track engagement (opens/clicks) and honor recipient unsubscribe preferences for marketing-style emails (Share Listings, Hot Sheet Alerts, etc.), while leaving auth/security/system emails untouched. No frontend UI changes.

## 1. Database migration

Create new tables (job-scoped to plug into existing `email_jobs`-driven flow; existing `email_opens`/`email_clicks` are scoped to `email_sends`/`email_campaigns` and stay untouched):

- `email_job_opens`
  - `id`, `job_id` (FK email_jobs ON DELETE CASCADE), `recipient_email`, `opened_at`, `user_agent`, `ip_address`
  - Unique partial index on `(job_id, recipient_email, date_trunc('hour', opened_at))` to dedupe rapid re-opens
- `email_job_clicks`
  - `id`, `job_id`, `recipient_email`, `url`, `clicked_at`, `user_agent`, `ip_address`
- `email_unsubscribes`
  - `email TEXT`, `category TEXT` (one of: `listing_shares`, `hot_sheet_alerts`, `marketing`, `all`)
  - `unsubscribed_at`, `source` (`one_click`, `preference_page`, `complaint`)
  - PK `(lower(email), category)`
- Helper SQL function `is_email_unsubscribed(_email text, _category text) RETURNS boolean` — returns true if a row exists for `(email, category)` OR `(email, 'all')`. SECURITY DEFINER, search_path=public.
- Lightweight reporting views:
  - `v_email_job_engagement` — per `email_jobs.id`: opens count, distinct openers, clicks count, distinct clickers, last_opened_at, last_clicked_at
  - `v_email_unsubscribes_status` — flattened recipient → array of categories
- RLS:
  - Enable RLS on all three new tables.
  - INSERT policies allow `service_role` only (writes go through edge functions using service key). Public SELECT denied.
  - SELECT policies: admins via `has_role(auth.uid(),'admin')`; agents may read engagement for jobs they sent (deferred — not required for this phase, only admin SELECT to keep scope minimal).

## 2. Edge functions (new)

- **`track-email-open-job`** (`GET`)
  - Query: `?j=<jobId>&r=<recipient_b64>`
  - Inserts into `email_job_opens` (best-effort), returns 1×1 transparent GIF with no-cache headers.
  - Always returns 200 even on errors (never break inbox rendering).
  - `verify_jwt = false`.
- **`track-email-click-job`** (`GET`)
  - Query: `?j=<jobId>&r=<recipient_b64>&u=<encoded_url>`
  - Inserts into `email_job_clicks`, then 302 redirect to `u`.
  - Validates `u` is `http(s)://` to avoid open-redirect of non-http schemes.
  - `verify_jwt = false`.
- **`email-unsubscribe`** (`GET` + `POST`)
  - Token = base64url HMAC-SHA256 of `email|category|EMAIL_UNSUB_SECRET`.
  - `GET ?t=<token>&e=<email_b64>&c=<category>` returns a minimal branded HTML page with a confirm form.
  - `POST` with same params verifies HMAC → upserts into `email_unsubscribes`. Returns minimal HTML confirmation page.
  - Idempotent. `verify_jwt = false`.
  - Adds new secret `EMAIL_UNSUB_SECRET` (auto-generate if absent on first deploy via Deno.env or instruct via `secrets`).

## 3. Renderer changes (`_shared/aacEmailTemplate.ts` + `renderEmailTemplate.ts`)

Add **opt-in** tracking parameters on `buildAacEmail` (default off → existing transactional callers unaffected):

```ts
interface AacEmailOptions {
  // existing fields ...
  tracking?: {
    jobId: string;
    recipientEmail: string;
    category: 'listing_shares' | 'hot_sheet_alerts' | 'marketing';
    unsubscribeToken: string; // pre-computed HMAC
  };
}
```

When `tracking` is present:
- Wrap CTA URL through `track-email-click-job` redirector.
- Inject 1×1 pixel `<img src=".../track-email-open-job?j=&r=">` immediately before `</body>`.
- Add an **unsubscribe footer block** to the dark footer:
  > "You're receiving this because <agent> shared properties with you. [Unsubscribe] · [Email preferences]"
- Footer styling matches existing dark footer; uses brand tokens.

When `tracking` is absent → template renders exactly as today (auth/security/system emails unchanged).

The renderer (`renderEmailTemplate`) accepts an optional 3rd arg `meta?: { jobId, recipientEmail, category }` and threads it into `buildAacEmail`.

## 4. Queue dispatcher integration (`_shared/sendEmail.ts` + `process-email-queue`)

- Read `job.payload.category` (new optional field).
- Marketing categories (`listing_shares`, `hot_sheet_alerts`, `marketing`):
  1. **Suppression check** — for each recipient, call `is_email_unsubscribed(recipient, category)`. Drop suppressed recipients. If all recipients are suppressed, mark job `cancelled` with `last_error = 'all recipients unsubscribed'`.
  2. **Compute HMAC unsubscribe token** per recipient from `EMAIL_UNSUB_SECRET`.
  3. Pass `meta = { jobId: job.id, recipientEmail, category }` to `renderEmailTemplate`. (Per-recipient render — required because pixel & links must be uniquely keyed per recipient.)
- Transactional/auth (no `category` field) → existing path, no tracking, no suppression. **No changes to behavior.**
- Resend webhook → on `email.complained` insert into `email_unsubscribes(category='all', source='complaint')`.

## 5. Share Listing functions

`send-listing-share/index.ts` and `send-bulk-listing-share/index.ts`:
- Add `category: 'listing_shares'` to enqueued `email_jobs.payload`.
- No other changes.

(Optional follow-up: tag `send-hot-sheet-alert`, `send-favorites-share`, etc. with the appropriate category. Out of scope for this phase unless trivial — will add `hot_sheet_alerts` to `send-hot-sheet-alert` only.)

## 6. Privacy posture

- Pixel & click endpoints store recipient email and IP only on action. No tracking on transactional/auth.
- Open dedupe at hour granularity (per `(job_id, recipient, hour)`).
- Unsubscribe is one-click via signed token (no auth required), CAN-SPAM-friendly.
- Add `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers on marketing sends in `sendEmail.ts`.

## 7. Verification

- `npm run build` passes.
- Deploy the 3 new functions + redeploy `process-email-queue`, `send-listing-share`, `send-bulk-listing-share`, `resend-webhook`.
- Curl test single + bulk share → verify rows in `email_job_opens` after fetching pixel; verify `email_job_clicks` after hitting click endpoint; verify suppression by inserting an `email_unsubscribes` row and re-enqueuing.

## Files touched

- New migration: `supabase/migrations/<ts>_email_engagement_and_unsubscribes.sql`
- New: `supabase/functions/track-email-open-job/index.ts`
- New: `supabase/functions/track-email-click-job/index.ts`
- New: `supabase/functions/email-unsubscribe/index.ts`
- Edited: `supabase/functions/_shared/aacEmailTemplate.ts` (tracking opts + footer)
- Edited: `supabase/functions/_shared/renderEmailTemplate.ts` (thread meta)
- Edited: `supabase/functions/_shared/sendEmail.ts` (suppression, per-recipient render, List-Unsubscribe headers)
- Edited: `supabase/functions/process-email-queue/index.ts` (category-aware dispatch, if needed)
- Edited: `supabase/functions/send-listing-share/index.ts` (add category)
- Edited: `supabase/functions/send-bulk-listing-share/index.ts` (add category)
- Edited: `supabase/functions/resend-webhook/index.ts` (complaint → unsubscribe)

## Out of scope (this phase)

- No frontend UI for the unsubscribe preferences page (basic edge-function HTML page only).
- No agent-facing dashboards for engagement (data lands in views; UI later).
- No change to bulk-campaign system (`email_sends` / `email_campaigns` / existing `email_opens` / `email_clicks` tables).
