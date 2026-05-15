## Problem

The 6 screenshots in Supabase Storage at `email-attachments/early-access-v2/` were updated, but the URLs in the email body are unchanged. Gmail (and most mail clients) proxy and cache remote images by URL. Once they've fetched `01-home.png`, they keep serving their cached copy — so the email looks identical to the previous send even though storage now has different bytes.

## Fix

Append a version query string to each image URL in `buildEarlyAccessUpdateV2Body()` in `supabase/functions/send-bulk-email/index.ts`. The query string is ignored by Supabase Storage but treated as a new URL by image proxies, forcing a fresh fetch.

### Change

In `supabase/functions/send-bulk-email/index.ts`:

- Add a constant `const IMG_VERSION = "v2";` (bump this number any time screenshots are replaced in the future).
- Update each of the 6 `img:` lines to append `?v=${IMG_VERSION}`, e.g.:
  ```
  img: `${STORAGE_BASE_V2}/01-home.png?v=${IMG_VERSION}`
  ```

### Deploy & verify

1. Redeploy `send-bulk-email`.
2. Send yourself a fresh test email.
3. Confirm the new screenshots render. Future screenshot swaps just need `IMG_VERSION` bumped (`v3`, `v4`, …).

No other files change. No DB or frontend changes.
