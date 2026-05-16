## Scope
Replace the `mailto:` button on `/access-error` with an in-page **Contact Support** dialog that submits through the existing internal email pipeline. No new pages, no router changes, no other files outside this flow.

## Changes

**1. `src/pages/AccessError.tsx`** — swap the `<a href="mailto:...">` button for a `<Button>` that opens a new dialog component (`<AccessErrorContactDialog />`). Black header/footer remain untouched.

**2. New `src/components/access-error/AccessErrorContactDialog.tsx`** — small shadcn `Dialog`:
- Fields: Name, Email (prefilled from `supabase.auth.getUser()` if signed in), Message (textarea, required)
- Submit calls `supabase.functions.invoke("send-contact-email", { body: { ... } })` with:
  - `agentEmail: "hello@allagentconnect.com"`
  - `agentName: "AAC Support"`
  - `senderName`, `senderEmail`, `message` from the form
  - `listingAddress: "Access Error — Support Request"` (subject context for existing template)
- On success: toast "Message sent — we'll be in touch." and close dialog
- On error: toast the error message
- Loading state on submit button; basic email/required validation

## Why reuse `send-contact-email`
It's already wired to Resend + the AAC unified email template, supports rate-limiting, and accepts arbitrary sender/recipient — no new edge function needed. Recipient is forced to `hello@allagentconnect.com`.

## Out of scope
Header, footer, route, auth flow, any other page, edge function changes.
