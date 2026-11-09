# Unsubscribe fix (PR #108, 9a4b793): read-only deployment verification

Nothing was edited, deployed, sent or invoked. No secrets were read, and Donna's signed link was not opened.

## 1. Which backend serves the live email links
- The backend connected to this Lovable project is **qocduqtfbsevnhlgsfka**. Donna's Nov 4 unsubscribe link points to the same one.
- It serves both the Lovable preview and the published app.
- The checked-in `supabase/config.toml` says `kinifeyelxwiwkrzoerf`. That's the migration (Nenad) project id, not the backend this project deploys to.
- **I can deploy backend functions to qocduqtfbsevnhlgsfka** from here, but only with your approval. Saved code functions here deploy automatically, so a merge to `main` that reaches this project would also update them.

## 2. Unsubscribe records (marketing/all only)
| Email | Record |
|---|---|
| dcoffin@erakey.net | **Unsubscribed from marketing**, source "preference_page", at **2026-11-06 20:00:06 UTC** |
| donna@donnacoffin.com | **No unsubscribe record** |

## 3. `email-unsubscribe` logs, Nov 6 20:00–20:46 UTC
- **None available.** The function-log tool returns no entries for `email-unsubscribe`.
- The request-log search returns zero calls in the last 7 days, including that window.
- The stored record shows the preference page saved one marketing opt-out at 20:00:06. Log history doesn't go back far enough to show what was requested or returned. That's an access limit, not proof that nothing was called.

## 4. Functions that use the shared sender (`_shared/sendEmail.ts`)
These are traced through all relative imports, from each function's `index.ts`.
- **Direct:** `kick-email-queue` (imports `../_shared/sendEmail.ts`, calls it at line 207).
- **Indirect, through `_shared/emailJobDelivery.ts` line 15:** `process-email-queue` and `send-single-email-job`.
- **Total to redeploy for a sendEmail change: 3 functions.** Add `email-unsubscribe` if PR #108 also changes it.

## 5. Open items / limits
- PR #108's diff hasn't been checked against this project's code. Next step is to confirm which files it changes and whether they match the 3–4 functions above.
- Whether donna@donnacoffin.com tried to unsubscribe can't be determined from logs. No record exists.
- This is separate from the migration cutover, and the migration project wasn't touched.

## Proposed next step (needs approval)
Review PR #108's changed files, then redeploy only the affected functions to qocduqtfbsevnhlgsfka. Send no test email unless you approve one to chris@allagentconnect.com.
