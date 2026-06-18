## Goal

Revert the agent verification success email from the current stripped-down version (`<p>hi, see you inside the group</p>`) back to the original branded AAC template.

## Scope

Single file: `supabase/functions/send-agent-approval-email/index.ts` — only the `approved === true` branch.

## Changes

1. Replace the approved-branch HTML with the original `buildAacEmail(...)` call:
   - Headline: "You've Been Accepted"
   - Preheader: `Welcome to All Agent Connect, {firstName}!`
   - Body: greeting + green checkmark "Your license has been verified" + "Sign in below to access your agent dashboard"
   - CTA: "Sign In to Your Account" → `passwordSetupUrl` (the generated magic link)
2. Restore the approved subject line to: `"You've Been Accepted — Sign In to Your Account"` (currently just `"AAC"`).
3. Keep the rejection branch and the apex-domain `TRANSACTIONAL_FROM` / `reply_to: hello@allagentconnect.com` exactly as they are now.
4. Deploy the `send-agent-approval-email` edge function.

## Verification

After deploy, trigger a test approval (or re-approve a test agent) and confirm the inbound email shows the branded layout, green check, and Sign In CTA — sent from `hello@allagentconnect.com`.
