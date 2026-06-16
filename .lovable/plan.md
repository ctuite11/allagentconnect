## Goal
Strip the "invite to new buyer" (buyer workspace invite) email to the absolute minimum for a deliverability test. No logos, no banners, no footer, no buttons, no links.

- **Subject:** `AAC`
- **Body:** `hi, see you inside the group`

## Files to change

### 1. `supabase/functions/send-buyer-workspace-invite/index.ts`
- Change enqueued `subject` from `` `${inviterName} invited you to share their home search` `` to `"AAC"`.
- Leave the invite token row creation untouched (so the workspace logic stays intact — only the email content is stripped).

### 2. `supabase/functions/resend-buyer-workspace-invite/index.ts`
- Same subject change to `"AAC"` wherever it enqueues the email.

### 3. `supabase/functions/_shared/renderEmailTemplate.ts`
- Replace the `buyer-workspace-invite` case body. Instead of calling `buildAacEmail(...)` (which wraps in the AAC shell with header logo, hero, CTA button, and footer), return a minimal raw HTML document:

```html
<!doctype html>
<html><body><p>hi, see you inside the group</p></body></html>
```

No `inviterName`, no `friendName`, no `inviteLink`, no CTA, no footer markup.

## Out of scope
- All other templates (auth, password reset, listing share, message notification, agent invite, hot sheet invite, etc.) are untouched.
- Sender identity (`hello@allagentconnect.com`) is untouched.
- DB row / token / RLS logic untouched — recipient just won't have a usable link in this test email.

## Deploy
After edits, deploy:
- `send-buyer-workspace-invite`
- `resend-buyer-workspace-invite`
- `process-email-queue` (picks up the updated `renderEmailTemplate.ts`)

## Note
Because the link is removed entirely, any buyer who receives this test email will NOT be able to accept the invite. Revert this template before going live.
