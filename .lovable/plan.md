# Admin Send Email: allow multiple recipients separated by commas

## What's wrong
The admin "Send Email" page only accepts one address. Typing `a@x.com, b@y.com` fails the single-address check and shows "Enter a valid email address".

## What changes
- The "Recipient email" box accepts several addresses separated by commas (spaces, semicolons and new lines also work).
- Before sending, every address is checked. If any are invalid, nothing sends and the error lists the bad ones.
- Duplicates are removed. Up to 25 addresses per send.
- Each person gets their **own separate email**. Recipients never see each other's addresses, and there is no CC or BCC.
- The confirmation lists who it went to. If some fail, it shows which ones were sent and which failed.
- The label becomes "Recipient email(s)" and the description no longer says "single recipient".

Nothing else changes: same email formats, the same sender (you), the same reply-to, and the same email queue and tracking. Nothing is sent as part of this work.

## Technical details
- `src/pages/AdminSendEmail.tsx`: parse `to` with `split(/[,;\s]+/)`, then trim, lowercase, dedupe, validate each address, and cap the list at 25. Change the input from `type="email"` to `type="text"`, because the browser's email type rejects lists. Call `admin-send-email` once per address in sequence and collect the per-address results.
- Edge function `admin-send-email` is unchanged: it stays one recipient per call, with an admin check on every call. No redeploy is needed.
- Add a small `parseRecipientList` helper with a test covering commas, spaces, duplicates, invalid addresses and the 25 cap.
