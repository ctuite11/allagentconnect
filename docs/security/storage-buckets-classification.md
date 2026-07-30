# Storage bucket classification (email attachments)

Last reviewed: 2026-07-30

## `email-attachments` — PUBLIC (intentional)

- `storage.buckets.public = true`. It was created public in migration
  `20260514204629_*.sql` and **remains public today**.
- Removing a public SELECT policy does **not** make a public bucket private:
  Supabase serves `/storage/v1/object/public/<bucket>/<path>` for any bucket
  flagged public, bypassing `storage.objects` RLS. Any prior statement that this
  bucket became private is incorrect.
- The frontend (`src/components/email/EmailComposerToolbar.tsx`) and email
  builders (`send-bulk-email`, `buildCommsCenterGuideEmailHtml.ts`) call
  `getPublicUrl()` because email clients must fetch images anonymously.
- **Allowed content: non-sensitive inline email images only** (logos, marketing
  screenshots, brand assets). Object paths are unguessable UUIDs, but must be
  treated as world-readable.
- **Never** upload license documents, IDs, contracts, client PII, or any
  private document here.

## `email-attachments-private` — PRIVATE

- Created 2026-07-30, `public = false`.
- RLS on `storage.objects`: authenticated users may INSERT / SELECT / DELETE
  only objects they own (`owner = auth.uid()`); no anon access, no public URL.
- Use for sensitive attachments; access via authenticated download or a
  short-lived signed URL (`createSignedUrl`). Do not call `getPublicUrl()` here.
