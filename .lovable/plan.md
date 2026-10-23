# Fix: password reset link signs the agent in without showing "Choose a new password"

## What happened
At 12:07 PM ET a "Forgot password" request for chris.tuite@compass.com produced a reset link. Clicking it at 12:07:46 signed the account in (the sign-in records show a recovery sign-in), but the app sent you to the normal home/dashboard instead of the "Choose a new password" page.

The reset screen itself exists and works. The gap is how the app recognises that you arrived from a reset link: it only notices when the link lands exactly on the sign-in callback page with the reset marker still in the web address. If the link lands anywhere else (for example the home page), or the marker is gone before the app checks it, you are treated as an ordinary sign-in. The exact landing address isn't saved in the sign-in records, so step 1 confirms which of these happened before changing anything.

## Plan
1. **Confirm the cause (read-only, no emails).** Run the reset link flow against the preview site with a fake link to see where the browser lands and which check misses it. No reset emails are sent for this.
2. **Always show the reset screen after a reset link.** Wherever a reset link signs someone in, send them straight to "Choose a new password", no matter which page it lands on. The fix uses the sign-in system's own "password recovery" signal, so it doesn't depend on the landing address.
3. **Mark reset links clearly.** Add a "this is a password reset" tag to the return address in reset emails (the agent "Forgot password" link and the admin "Send reset" button), so the app spots it on arrival. The email's wording and design stay exactly the same.
4. **Leave normal sign-ins alone.** Sign-in links, the License Verified setup flow and regular logins keep working as they do now. An old reset marker must never take over a later normal sign-in.
5. **Tests.** Add small tests for these rules: a reset link always leads to the reset screen; a normal sign-in never does; the setup flow still goes to account setup.
6. **Check in the preview.** Use a fake reset sign-in to confirm the reset screen appears and that saving a new password works. No real emails are sent. Afterwards you can try "Forgot password" yourself once to confirm it end to end.

## Not changing
- Email templates, sender address or wording
- Any agent's password, preferences or account
- No test emails sent by me

## Technical details
- Add a global `onAuthStateChange` listener at app level: `PASSWORD_RECOVERY` sets `aac_recovery_flow` and navigates to `/password-reset` (or `/agent-setup` when the setup flag is set), so routing doesn't depend on `/auth/callback` being the landing route or on the hash still being present.
- `send-password-reset` callers (`Auth.tsx`, `AdminApprovals.tsx`, plus Buyer/Consumer/Dcmls auth pages) send `redirectUrl` = `/auth/callback?type=recovery`; `AuthCallback` already reads `type=recovery` from the query string. Only the redirect parameter changes; the email builder doesn't.
- Extend the `main.tsx` rescue so it also catches a recovery marker in the query string as well as in the hash.
- Tests sit next to `src/lib/authRecovery.ts` and cover the routing decision.
