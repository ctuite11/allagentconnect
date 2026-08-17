# Comms Center broadcast attachments (photos + video)

Adds photo/video attachments to the Communications Center broadcast composer only. The 1-to-1 Messages attachment feature (`message-attachments` bucket, `src/lib/messageAttachments.ts`) is left completely untouched.

## Storage + database

- New **private** bucket `comms-attachments`.
- Upload path contract: `<senderUserId>/<uuid>.<ext>` — folder 1 must equal `auth.uid()`.
- `storage.objects` RLS: authenticated users may INSERT/UPDATE/DELETE only under their own uid folder; SELECT allowed to authenticated users (feed viewing) via short-lived signed URLs; no anon access, no public URL.
- New table `public.comms_broadcast_attachments`:
  - `broadcast_id` (FK to `comms_broadcasts`, cascade delete), `sender_id`, `path`, `kind` (`image` | `video`), `mime_type`, `file_name`, `size_bytes`, `sort_order`, `created_at`.
  - GRANTs: SELECT/INSERT to `authenticated`, ALL to `service_role`.
  - RLS: authenticated agents can read all rows (the feed is network-wide, same visibility as `comms_broadcasts`); only the owning sender can insert/delete their own rows.

## Frontend

- New `src/components/communication-center/CommsAttachmentPicker.tsx`: paperclip "Add photos or video" control, multi-select, image thumbnails + video previews, per-file upload progress, remove-before-send, and reuse of the Messages MIME/size rules (image/*, video/*, 50 MB cap) via a small shared validation helper — but with Comms storage paths and Comms security.
- `SendEmailDialog.tsx`: mount the picker beneath the message field; files upload to `comms-attachments` as they are added; on send, pass `attachments: [{path, kind, mimeType, name, size}]` to the Edge Function. Orphaned uploads are removed on cancel/close.
- `CommunicationsFeed.tsx`: fetch attachments for listed broadcasts, batch-sign URLs, render an image grid (click to open larger in a dialog) and `<video controls>` players.

## Edge Function

- `send-client-need-notification` accepts an optional `attachments` array, validates shape, count (max 10), kind, and that every `path` starts with the authenticated sender's uid folder. After the `comms_broadcasts` row is created, inserts the attachment rows keyed to that broadcast id.
- Email/digest V1: no media embedded or attached. When attachments exist, a single line is added to the existing `itemHtml` — e.g. "Chris shared 3 photos and 1 video — View attachments" linking to the Communications Feed. Nothing else in email composition changes.
- Explicitly unchanged: audience resolution, preference matching, opt-in gating, cadence/digest partitioning, dedup, pause switches, reminders, recipient counts, and dry-run output.

## Tests

- Unit tests for attachment validation/normalization and the "3 photos and 1 video" summary string.
- Security tests: an authenticated agent cannot write, overwrite, or delete another sender's `comms-attachments` object or attachment row; an unauthenticated request cannot read bucket objects or the attachments table.
- Regression test: a broadcast with no attachments produces byte-identical email/digest payloads to today.

## Out of scope / not done

- No deploy, no test broadcast, no test email. Implementation + report only.
- Messages attachments, Hot Sheets, and all other email streams untouched.

## Note

The email CTA line touches broadcast email content, which is under the standing "email templates frozen" rule. Treating your request as explicit approval for this one line in `send-client-need-notification` only.
