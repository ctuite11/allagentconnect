## Goal

Let agents attach photos and insert links when composing the bulk email used to reach early-access agents (and any other bulk recipient list). Photos are uploaded to storage and embedded inline as `<img>` in the email body. Links are inserted as `<a>` tags. Recipients receive a real HTML email with images and clickable links.

## Scope

- **In scope:** `BulkEmailDialog` (the dialog used today to email lists) and the `send-bulk-email` edge function so HTML content is preserved.
- **Out of scope:** `SingleClientEmailDialog`, `EmailAgentDialog (admin)`, `SendEmailDialog`, `EmailShareModal`. We'll roll those out next once this is working.

## UX

Above the message textarea, add a small toolbar:

```
[ 🔗 Insert link ]  [ 🖼 Insert photo ]    (file size hint)
```

- **Insert link**: small popover with two inputs — "Link text" + "URL" — and an "Insert" button. Inserts `<a href="URL" target="_blank" rel="noopener">Link text</a>` at the textarea cursor position.
- **Insert photo**: opens a file picker (PNG/JPG/WEBP, max 5 MB). On select:
  1. Upload to Supabase Storage bucket `email-attachments` under `bulk/{userId}/{uuid}-{filename}`.
  2. Get the public URL.
  3. Insert `<img src="{publicUrl}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />` at the textarea cursor.
- Show a small spinner + toast while uploading. Show inserted HTML inline in the textarea (users see the tag — acceptable for this internal tool; mirrors how they already write `{client_name}` variables).
- Add a tiny helper line: "Tip: HTML, links, and inline images are supported."

## Backend

- **Storage bucket**: create public bucket `email-attachments` if it doesn't exist, with RLS allowing authenticated users to upload to their own folder and public read.
- **`send-bulk-email` edge function**: stop wrapping the message with `message.replace(/\n/g, '<br>')` blindly. Instead:
  - If the message contains HTML tags (heuristic: `/<[a-z][\s\S]*>/i`), use it as-is inside the template body.
  - Otherwise, escape + convert newlines to `<br>` (current behaviour).
  - This preserves `<img>` and `<a>` tags inserted from the composer while keeping plain-text messages safe.
- No change to recipient handling, rate limiting, tracking pixel, or campaign logging.

## Files to change

- `src/components/BulkEmailDialog.tsx` — add toolbar, link popover, file input, upload handler, cursor-aware insert helper.
- `src/components/email/EmailComposerToolbar.tsx` (new) — extracted toolbar so we can drop it into other composers later.
- `supabase/functions/send-bulk-email/index.ts` — branch HTML vs plain message rendering.
- New migration: create `email-attachments` storage bucket + policies.

## Acceptance

- Composing a bulk email, clicking "Insert photo" uploads a file and inserts an `<img>` at the cursor.
- Clicking "Insert link" inserts a working `<a href>` at the cursor.
- Sent email renders the image inline and the link is clickable in the recipient's inbox.
- Plain-text messages (no HTML) still render with line breaks as before.
- One row per recipient in `email_jobs`, no regressions in tracking pixel or rate limit.
